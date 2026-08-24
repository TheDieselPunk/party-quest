import type { Attribute, Character, CompletedSession } from '../domain/types'
import { ALL_ATTRIBUTES, MUSCLE_TO_ATTRIBUTE } from '../domain/types'

// ---------------------------------------------------------------------------
// The game layer. Training volume feeds six attributes mapped to muscle groups,
// so balanced, sound programming is exactly what levels a character evenly. A
// personal record (progressive overload) is the core "Level Up!" moment.
// ---------------------------------------------------------------------------

const XP_PRIMARY_SET = 10
const XP_SECONDARY_SET = 5
const XP_CONDITIONING_ROUND = 8
const XP_SESSION_COMPLETE = 20
const XP_PR_BONUS = 25

/** Level for a given attribute XP total (gentle square-root curve). */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 40))
}

export function xpForLevel(level: number): number {
  return level * level * 40
}

/** Progress [0,1] toward the next level for an attribute. */
export function levelProgress(xp: number): number {
  const lvl = levelFromXp(xp)
  const cur = xpForLevel(lvl)
  const next = xpForLevel(lvl + 1)
  return next === cur ? 0 : (xp - cur) / (next - cur)
}

/** Overall character level = sum of attribute levels. */
export function characterLevel(character: Character): number {
  return ALL_ATTRIBUTES.reduce((sum, a) => sum + levelFromXp(character.xp[a]), 0)
}

export function emptyCharacter(profileId: string): Character {
  const xp = {} as Record<Attribute, number>
  for (const a of ALL_ATTRIBUTES) xp[a] = 0
  return { profileId, xp, totalSessions: 0, bests: {}, streak: 0 }
}

/** Epley estimated 1RM, used for PR detection. */
export function est1rm(load: number, reps: number): number {
  return load * (1 + reps / 30)
}

export interface PrResult {
  exerciseId: string
  name: string
  attribute: Attribute
  prevEst: number
  newEst: number
}

export interface LevelUp {
  attribute: Attribute
  from: number
  to: number
}

export interface SessionRewards {
  character: Character
  xpGained: Record<Attribute, number>
  totalXp: number
  prs: PrResult[]
  levelUps: LevelUp[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Apply a completed session to a character: award attribute XP from volume,
 * detect PRs (progressive overload → level-up), and update the streak.
 */
export function applySession(prev: Character, session: CompletedSession): SessionRewards {
  const before = { ...prev.xp }
  const xp = { ...prev.xp }
  const bests = { ...prev.bests }
  const gained = {} as Record<Attribute, number>
  for (const a of ALL_ATTRIBUTES) gained[a] = 0

  const add = (attr: Attribute, amount: number) => { xp[attr] += amount; gained[attr] += amount }

  const prs: PrResult[] = []

  for (const ex of session.exercises) {
    const working = ex.sets.filter((s) => s.done && !s.warmup)
    if (!working.length) continue

    // Volume XP → attributes via each involved muscle.
    for (const set of working) {
      void set
      for (const mi of ex.muscles) {
        const attr = MUSCLE_TO_ATTRIBUTE[mi.muscle]
        add(attr, mi.role === 'primary' ? XP_PRIMARY_SET : XP_SECONDARY_SET)
      }
    }
    if (ex.muscles.length === 0) {
      // conditioning: reward grit per round
      add('grit', working.length * XP_CONDITIONING_ROUND)
    }

    // PR detection on loaded sets.
    const loaded = working.filter((s) => s.load != null && s.load > 0)
    if (loaded.length) {
      const best = loaded.reduce(
        (b, s) => {
          const e = est1rm(s.load!, s.reps)
          return e > b.est ? { est: e, load: s.load!, reps: s.reps } : b
        },
        { est: 0, load: 0, reps: 0 },
      )
      const prior = bests[ex.exerciseId]
      if (best.est > 0 && (!prior || best.est > prior.est1rm + 0.01)) {
        const attr = ex.muscles.find((m) => m.role === 'primary')
          ? MUSCLE_TO_ATTRIBUTE[ex.muscles.find((m) => m.role === 'primary')!.muscle]
          : 'grit'
        if (prior) {
          prs.push({ exerciseId: ex.exerciseId, name: ex.name, attribute: attr, prevEst: prior.est1rm, newEst: best.est })
          add(attr, XP_PR_BONUS)
        }
        bests[ex.exerciseId] = { load: best.load, reps: best.reps, est1rm: best.est }
      }
    }
  }

  add('vitality', XP_SESSION_COMPLETE)

  // Streak: consecutive calendar-ish days with a session (within ~2 days).
  let streak = prev.streak
  if (prev.lastSessionDate) {
    const gap = session.date - prev.lastSessionDate
    streak = gap <= 3 * DAY_MS ? prev.streak + 1 : 1
  } else {
    streak = 1
  }

  const levelUps: LevelUp[] = []
  for (const a of ALL_ATTRIBUTES) {
    const from = levelFromXp(before[a])
    const to = levelFromXp(xp[a])
    if (to > from) levelUps.push({ attribute: a, from, to })
  }

  const character: Character = {
    ...prev,
    xp,
    bests,
    totalSessions: prev.totalSessions + 1,
    streak,
    lastSessionDate: session.date,
  }

  return { character, xpGained: gained, totalXp: ALL_ATTRIBUTES.reduce((s, a) => s + gained[a], 0), prs, levelUps }
}
