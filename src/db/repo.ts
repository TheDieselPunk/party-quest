import type {
  Character, CompletedSession, LoggedExercise, PrescribedExercise, Profile,
} from '../domain/types'
import type { ActiveWorkout } from '../domain/active'
import { logsFromPlan } from '../domain/active'
import { db } from './db'
import { makeDefaultProfile } from '../domain/defaults'
import { emptyCharacter, applySession, type SessionRewards } from '../rpg/character'
import {
  generateWorkout, buildHistoryIndex, type GenerateOptions,
} from '../engine'
import { EXERCISES_BY_ID } from '../data/exercises'
import { EQUIPMENT_BY_ID, modeOf } from '../data/equipment'
import { repPrescription, recommendLoad } from '../engine'
import { queuePush, stampNow } from '../cloud/sync'

// --- profiles ---------------------------------------------------------------
export async function createProfile(init: Partial<Profile>): Promise<Profile> {
  const profile = stampNow(makeDefaultProfile(init))
  const character = stampNow(emptyCharacter(profile.id))
  await db.profiles.put(profile)
  await db.characters.put(character)
  queuePush('profiles', profile.id)
  queuePush('characters', profile.id)
  return profile
}

export async function saveProfile(profile: Profile): Promise<void> {
  stampNow(profile)
  await db.profiles.put(profile)
  queuePush('profiles', profile.id)
}

export async function deleteProfile(id: string): Promise<void> {
  const sessionIds = (await db.sessions.where('profileId').equals(id).primaryKeys()) as string[]
  await db.transaction('rw', db.profiles, db.characters, db.sessions, db.active, async () => {
    await db.profiles.delete(id)
    await db.characters.delete(id)
    await db.active.delete(id)
    await db.sessions.where('profileId').equals(id).delete()
  })
  queuePush('profiles', id, 'delete')
  queuePush('characters', id, 'delete')
  for (const sid of sessionIds) queuePush('sessions', sid, 'delete')
}

// --- history ----------------------------------------------------------------
export async function sessionsFor(profileId: string): Promise<CompletedSession[]> {
  return db.sessions.where('profileId').equals(profileId).reverse().sortBy('date')
}

/**
 * Bulk-import historical sessions (e.g. migrating from another app). Skips
 * duplicates, then rebuilds the RPG character from the full history in
 * chronological order so levels/PRs/streak reflect the imported data.
 */
export async function importSessions(
  profile: Profile,
  sessions: CompletedSession[],
): Promise<{ added: number; skipped: number; character: Character }> {
  const existing = await db.sessions.where('profileId').equals(profile.id).toArray()
  const seen = new Set(existing.map((s) => `${s.date}|${s.title}`))
  let added = 0
  let skipped = 0
  for (const s of sessions) {
    const key = `${s.date}|${s.title}`
    if (seen.has(key)) { skipped++; continue }
    stampNow(s)
    await db.sessions.put(s)
    queuePush('sessions', s.id)
    seen.add(key)
    added++
  }

  const all = (await db.sessions.where('profileId').equals(profile.id).toArray())
    .sort((a, b) => a.date - b.date)
  let character = emptyCharacter(profile.id)
  for (const s of all) character = applySession(character, s).character
  stampNow(character)
  await db.characters.put(character)
  queuePush('characters', profile.id)

  return { added, skipped, character }
}

// --- workout generation & lifecycle ----------------------------------------
export async function startWorkout(
  profile: Profile,
  opts: Omit<GenerateOptions, 'history'> = {},
): Promise<ActiveWorkout> {
  const history = buildHistoryIndex(await sessionsFor(profile.id))
  const plan = generateWorkout(profile, { ...opts, history })
  const active: ActiveWorkout = {
    profileId: profile.id,
    startedAt: Date.now(),
    plan,
    logs: logsFromPlan(plan),
  }
  await db.active.put(active)
  return active
}

export async function saveActive(active: ActiveWorkout): Promise<void> {
  await db.active.put(active)
}

export async function discardActive(profileId: string): Promise<void> {
  await db.active.delete(profileId)
}

/**
 * Swap a busy machine's exercise for one of its alternatives, re-deriving the
 * recommended load for the new movement from the trainee's history.
 */
export async function swapExercise(
  profile: Profile,
  active: ActiveWorkout,
  exerciseIndex: number,
  altId: string,
): Promise<ActiveWorkout> {
  const alt = EXERCISES_BY_ID[altId]
  if (!alt) return active
  const history = buildHistoryIndex(await sessionsFor(profile.id))
  const rx = repPrescription(profile.goal, alt.repClass)
  const original = active.plan.exercises[exerciseIndex]
  const nSets = active.logs[exerciseIndex].filter((s) => !s.warmup).length || original.sets.length
  const rec = recommendLoad(alt, profile.experience, rx.reps, profile.rirTarget, history[alt.id])
  const mode = modeOf(alt.equipmentId, alt.modeId)
  const eq = EQUIPMENT_BY_ID[alt.equipmentId]

  const replacement: PrescribedExercise = {
    exerciseId: alt.id,
    name: alt.name,
    equipmentId: alt.equipmentId,
    equipmentName: eq?.name ?? alt.equipmentId,
    modeId: alt.modeId,
    modeName: mode?.name,
    modeSetup: mode?.setup,
    kind: alt.kind,
    targetMuscle: original.targetMuscle,
    muscles: alt.muscles,
    sets: Array.from({ length: nSets }, () => ({
      reps: alt.kind === 'conditioning' ? [1, 1] as [number, number] : rx.reps,
      load: rec.load,
      calibration: rec.calibration,
    })),
    restSeconds: rx.restSeconds,
    cues: alt.cues,
    altIds: (alt.altIds ?? []).filter((id) => id !== alt.id),
    // dropping out of any superset it was part of
    supersetGroup: undefined,
    rationale: rec.reason,
  }

  const plan = { ...active.plan, exercises: active.plan.exercises.map((e, i) => (i === exerciseIndex ? replacement : e)) }
  const logs = active.logs.map((l, i) =>
    i === exerciseIndex
      ? replacement.sets.map((s) => ({ reps: s.reps[1], load: s.load, rir: null, done: false }))
      : l,
  )
  const next = { ...active, plan, logs }
  await db.active.put(next)
  return next
}

/**
 * Finish the active workout: persist a CompletedSession, apply RPG rewards,
 * advance the split rotation, and clear the in-progress state.
 */
export async function finishWorkout(
  profile: Profile,
  active: ActiveWorkout,
): Promise<SessionRewards> {
  const exercises: LoggedExercise[] = active.plan.exercises.map((pe, i) => ({
    exerciseId: pe.exerciseId,
    name: pe.name,
    equipmentId: pe.equipmentId,
    targetMuscle: pe.targetMuscle,
    muscles: pe.muscles,
    sets: active.logs[i],
  }))

  const session: CompletedSession = stampNow({
    id: crypto.randomUUID(),
    profileId: profile.id,
    planId: active.plan.id,
    date: Date.now(),
    title: active.plan.title,
    goal: active.plan.goal,
    exercises,
    durationSeconds: Math.round((Date.now() - active.startedAt) / 1000),
  })

  const character = (await db.characters.get(profile.id)) ?? emptyCharacter(profile.id)
  const rewards = applySession(character, session)
  stampNow(rewards.character)
  const now = Date.now()

  await db.transaction('rw', db.sessions, db.characters, db.active, db.profiles, async () => {
    await db.sessions.put(session)
    await db.characters.put(rewards.character)
    await db.active.delete(profile.id)
    await db.profiles.update(profile.id, { dayIndex: profile.dayIndex + 1, updatedAt: now })
  })

  queuePush('sessions', session.id)
  queuePush('characters', profile.id)
  queuePush('profiles', profile.id)
  return rewards
}
