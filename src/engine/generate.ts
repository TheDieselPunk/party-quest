import type {
  Exercise, Muscle, PrescribedExercise, PrescribedSet, Profile, WorkoutPlan,
} from '../domain/types'
import { EQUIPMENT_BY_ID, modeOf } from '../data/equipment'
import { EXERCISES_BY_ID, exercisesForLocation } from '../data/exercises'
import { dayForIndex, type Slot } from './templates'
import {
  repPrescription, setsForExercise, setWorkSeconds,
  SUPERSET_TRANSITION_SECONDS, CONDITIONING_ROUND_SECONDS,
} from './params'
import { recommendLoad, snapLoad, type HistoryIndex } from './weight'

export interface GenerateOptions {
  busy?: boolean
  /** Override the profile's rotation position (else profile.dayIndex). */
  dayIndex?: number
  /** Latest performance per exercise id, for progression. */
  history?: HistoryIndex
  now?: number
}

// --- internal working shape -------------------------------------------------
interface Picked {
  exercise: Exercise
  role: 'primary' | 'accessory'
  targetMuscle: Muscle
}

const MAX_EXERCISES = 9

const ANTAGONIST: Partial<Record<Muscle, Muscle>> = {
  chest: 'back', back: 'chest',
  quads: 'hamstrings', hamstrings: 'quads',
  biceps: 'triceps', triceps: 'biceps',
}

function orderRank(ex: Exercise, role: 'primary' | 'accessory'): number {
  const base = { 'heavy-compound': 0, compound: 1, isolation: 2, core: 3, conditioning: 4 }[ex.repClass]
  return base * 2 + (role === 'primary' ? 0 : 1)
}

function primaryMuscle(ex: Exercise, fallback: Muscle): Muscle {
  return ex.muscles.find((m) => m.role === 'primary')?.muscle ?? fallback
}

function pickForSlot(slot: Slot, pool: Exercise[], used: Set<string>): Exercise | undefined {
  const isConditioning = slot.patterns.includes('conditioning')
  for (const pattern of slot.patterns) {
    const cand = pool.find((ex) =>
      !used.has(ex.id) && ex.pattern === pattern &&
      (isConditioning
        ? ex.kind === 'conditioning'
        : ex.muscles.some((m) => m.role === 'primary' && m.muscle === slot.muscle)),
    )
    if (cand) return cand
  }
  if (isConditioning) return pool.find((ex) => !used.has(ex.id) && ex.kind === 'conditioning')
  return pool.find((ex) =>
    !used.has(ex.id) && ex.muscles.some((m) => m.role === 'primary' && m.muscle === slot.muscle))
}

/** Available alternatives for an exercise, filtered to the location's pool. */
function availableAlts(ex: Exercise, poolIds: Set<string>): string[] {
  return (ex.altIds ?? []).filter((id) => poolIds.has(id) && id !== ex.id)
}

function buildPrescribed(
  picked: Picked,
  profile: Profile,
  history: HistoryIndex,
  poolIds: Set<string>,
): PrescribedExercise {
  const ex = picked.exercise
  const rx = repPrescription(profile.goal, ex.repClass)
  const nSets = setsForExercise(ex.repClass, profile.experience, picked.role)
  const rec = recommendLoad(ex, profile.experience, rx.reps, profile.rirTarget, history[ex.id])

  const sets: PrescribedSet[] = []
  for (let i = 0; i < nSets; i++) {
    sets.push({
      reps: ex.kind === 'conditioning' ? [1, 1] : rx.reps,
      load: rec.load,
      calibration: rec.calibration,
    })
  }

  const eq = EQUIPMENT_BY_ID[ex.equipmentId]
  const mode = modeOf(ex.equipmentId, ex.modeId)
  return {
    exerciseId: ex.id,
    name: ex.name,
    equipmentId: ex.equipmentId,
    equipmentName: eq?.name ?? ex.equipmentId,
    modeId: ex.modeId,
    modeName: mode?.name,
    modeSetup: mode?.setup,
    kind: ex.kind,
    targetMuscle: picked.targetMuscle,
    muscles: ex.muscles,
    sets,
    restSeconds: rx.restSeconds,
    cues: ex.cues,
    altIds: availableAlts(ex, poolIds),
    rationale: rec.reason,
  }
}

/** Add ramp-up warm-up sets to the first heavy working lift. */
function addWarmup(list: PrescribedExercise[], profile: Profile): void {
  if (!profile.warmup) return
  const main = list.find(
    (pe) => (pe.kind === 'compound') && pe.sets.some((s) => s.load != null),
  )
  if (!main) return
  const work = main.sets.find((s) => s.load != null)!.load!
  const eqId = main.equipmentId
  const warm: PrescribedSet[] = [
    { reps: [8, 8], load: snapLoad(eqId, work * 0.5), warmup: true },
    { reps: [5, 5], load: snapLoad(eqId, work * 0.75), warmup: true },
  ]
  main.sets = [...warm, ...main.sets]
}

// --- superset pass ----------------------------------------------------------
function applySupersets(list: PrescribedExercise[], busy: boolean): void {
  let group = 1

  // 1) Same-unit: two movements on one multi-mode machine → occupy it once.
  // Heavy primary compounds are kept as straight sets (they deserve full rest
  // and focus), so only accessory/isolation/core movements get paired here.
  const byEquip = new Map<string, PrescribedExercise[]>()
  for (const pe of list) {
    const eq = EQUIPMENT_BY_ID[pe.equipmentId]
    const isHeavy = EXERCISES_BY_ID[pe.exerciseId]?.repClass === 'heavy-compound'
    if (!isHeavy && eq?.isMachine && eq.modes && eq.modes.length >= 2) {
      const arr = byEquip.get(pe.equipmentId) ?? []
      arr.push(pe)
      byEquip.set(pe.equipmentId, arr)
    }
  }
  for (const arr of byEquip.values()) {
    if (arr.length >= 2) {
      const [a, b] = arr
      a.supersetGroup = b.supersetGroup = group++
      a.supersetKind = b.supersetKind = 'same-unit'
      a.transitionSeconds = b.transitionSeconds = SUPERSET_TRANSITION_SECONDS
    }
  }

  // 2) Antagonist cross-machine pairs — only when the gym is not busy.
  if (!busy) {
    const free = list.filter((pe) => pe.supersetGroup == null && pe.kind !== 'conditioning')
    const usedIdx = new Set<number>()
    for (let i = 0; i < free.length; i++) {
      if (usedIdx.has(i)) continue
      const a = free[i]
      const want = ANTAGONIST[a.targetMuscle]
      if (!want) continue
      for (let j = i + 1; j < free.length; j++) {
        if (usedIdx.has(j)) continue
        const b = free[j]
        if (b.targetMuscle === want && b.equipmentId !== a.equipmentId) {
          a.supersetGroup = b.supersetGroup = group++
          a.supersetKind = b.supersetKind = 'antagonist'
          a.transitionSeconds = b.transitionSeconds = SUPERSET_TRANSITION_SECONDS
          usedIdx.add(i); usedIdx.add(j)
          break
        }
      }
    }
  }
}

/** Emit exercises so superset partners sit next to each other. */
function reorderForSupersets(list: PrescribedExercise[]): PrescribedExercise[] {
  const out: PrescribedExercise[] = []
  const emitted = new Set<PrescribedExercise>()
  for (const pe of list) {
    if (emitted.has(pe)) continue
    out.push(pe)
    emitted.add(pe)
    if (pe.supersetGroup != null) {
      for (const partner of list) {
        if (!emitted.has(partner) && partner.supersetGroup === pe.supersetGroup) {
          out.push(partner)
          emitted.add(partner)
        }
      }
    }
  }
  return out
}

// --- time estimation & fitting ---------------------------------------------
function exerciseSeconds(pe: PrescribedExercise): number {
  if (pe.kind === 'conditioning') return pe.sets.length * CONDITIONING_ROUND_SECONDS
  let t = 0
  for (const s of pe.sets) {
    const work = setWorkSeconds(s.reps)
    t += work + (s.warmup ? 45 : pe.restSeconds)
  }
  return t
}

export function estimateSessionSeconds(list: PrescribedExercise[]): number {
  const seen = new Set<number>()
  let total = 0
  for (const pe of list) {
    if (pe.supersetGroup != null && pe.transitionSeconds != null) {
      if (seen.has(pe.supersetGroup)) continue
      seen.add(pe.supersetGroup)
      const partners = list.filter((x) => x.supersetGroup === pe.supersetGroup)
      const rounds = Math.max(...partners.map((x) => x.sets.filter((s) => !s.warmup).length))
      const workPerRound = partners.reduce((sum, x) => sum + setWorkSeconds(x.sets[0]?.reps ?? [10, 10]) + (x.transitionSeconds ?? 0), 0)
      const rest = Math.max(...partners.map((x) => x.restSeconds))
      const warmSecs = partners.reduce((sum, x) =>
        sum + x.sets.filter((s) => s.warmup).reduce((a, s) => a + setWorkSeconds(s.reps) + 45, 0), 0)
      total += rounds * (workPerRound + rest) + warmSecs
    } else {
      total += exerciseSeconds(pe)
    }
  }
  return total
}

function fitToTime(list: PrescribedExercise[], targetMinutes: number): PrescribedExercise[] {
  const target = targetMinutes * 60
  let result = [...list]

  // Trim while too long. Shave accessory sets BEFORE dropping whole movements,
  // so every muscle still gets some volume (protects e.g. core, which sorts
  // last). Main compounds keep their prescribed sets.
  let guard = 40
  while (estimateSessionSeconds(result) > target * 1.05 && guard-- > 0) {
    // a) shave a set from the last non-main-compound exercise with spare sets
    const shave = [...result].reverse().find(
      (pe) => !isMainCompound(pe) && pe.sets.filter((s) => !s.warmup).length > 2,
    )
    if (shave) {
      const idx = shave.sets.map((s) => !s.warmup).lastIndexOf(true)
      shave.sets.splice(idx, 1)
      continue
    }
    // b) only then drop the lowest-priority accessory single (from the end)
    const dropIdx = [...result].reverse().findIndex(
      (pe) => pe.supersetGroup == null && pe.kind !== 'conditioning' && !isMainCompound(pe),
    )
    if (dropIdx >= 0) {
      result.splice(result.length - 1 - dropIdx, 1)
      continue
    }
    break
  }

  // Grow while too short (add working sets, capped).
  guard = 40
  while (estimateSessionSeconds(result) < target * 0.9 && guard-- > 0) {
    const grow = result.find((pe) => {
      const working = pe.sets.filter((s) => !s.warmup).length
      const cap = isMainCompound(pe) ? 5 : pe.kind === 'conditioning' ? 6 : 4
      return working < cap
    })
    if (!grow) break
    const template = grow.sets.find((s) => !s.warmup) ?? grow.sets[grow.sets.length - 1]
    grow.sets.push({ ...template })
  }

  return result
}

function isMainCompound(pe: PrescribedExercise): boolean {
  const ex = EXERCISES_BY_ID[pe.exerciseId]
  return !!ex && (ex.repClass === 'heavy-compound' || ex.repClass === 'compound')
}

// --- main entry -------------------------------------------------------------
export function generateWorkout(profile: Profile, options: GenerateOptions = {}): WorkoutPlan {
  const busy = options.busy ?? true
  const history = options.history ?? {}
  const dayIndex = options.dayIndex ?? profile.dayIndex

  // Pool: exercises whose equipment is present at the location, minus avoided.
  const avoidMuscles = new Set(profile.avoidMuscles)
  const avoidPatterns = new Set(profile.avoidPatterns)
  const pool = exercisesForLocation(profile.location).filter(
    (ex) => !avoidPatterns.has(ex.pattern) &&
      !ex.muscles.some((m) => m.role === 'primary' && avoidMuscles.has(m.muscle)),
  )
  const poolIds = new Set(pool.map((e) => e.id))

  const day = dayForIndex(profile, dayIndex)

  // How many conditioning finishers to append. Kept separate from the strength
  // slots so the exercise cap can't crowd them out (important for fat loss).
  let condCount = 0
  if (profile.goal === 'fatloss') condCount = profile.cardio === 'high' ? 2 : 1
  else if (profile.cardio !== 'none') condCount = 1

  // Select strength exercises for the day's slots (within-session variety).
  const used = new Set<string>()
  const picks: Picked[] = []
  const strengthCap = MAX_EXERCISES - condCount
  for (const slot of day.slots) {
    if (picks.length >= strengthCap) break
    const ex = pickForSlot(slot, pool, used)
    if (!ex) continue
    used.add(ex.id)
    picks.push({ exercise: ex, role: slot.role, targetMuscle: primaryMuscle(ex, slot.muscle) })
  }

  // Append conditioning finisher(s) for fat loss / requested cardio.
  const condSlot: Slot = { patterns: ['conditioning'], muscle: 'core', role: 'accessory' }
  for (let i = 0; i < condCount; i++) {
    const ex = pickForSlot(condSlot, pool, used)
    if (!ex) break
    used.add(ex.id)
    picks.push({ exercise: ex, role: 'accessory', targetMuscle: primaryMuscle(ex, 'core') })
  }

  // Order hardest → easiest (stable within rank).
  picks.sort((a, b) => orderRank(a.exercise, a.role) - orderRank(b.exercise, b.role))

  // Prescribe sets/reps/rest/load.
  let prescribed = picks.map((pk) => buildPrescribed(pk, profile, history, poolIds))

  addWarmup(prescribed, profile)
  applySupersets(prescribed, busy)
  prescribed = reorderForSupersets(prescribed)
  prescribed = fitToTime(prescribed, profile.sessionMinutes)
  // supersets may have been split by trimming; re-tidy ordering
  prescribed = reorderForSupersets(prescribed)

  const estMinutes = Math.round(estimateSessionSeconds(prescribed) / 60)

  return {
    id: crypto.randomUUID(),
    profileId: profile.id,
    createdAt: options.now ?? Date.now(),
    title: day.label,
    dayLabel: day.key,
    goal: profile.goal,
    estMinutes,
    busy,
    warmup: profile.warmup
      ? ['5 min easy cardio to raise the heart rate', 'Dynamic mobility for the day’s main joints', 'Ramp-up sets are built into your first lift']
      : [],
    exercises: prescribed,
  }
}
