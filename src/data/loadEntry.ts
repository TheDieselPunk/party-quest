import type { Exercise } from '../domain/types'
import { EQUIPMENT_BY_ID } from './equipment'
import { EXERCISES_BY_ID } from './exercises'

// ---------------------------------------------------------------------------
// How a weight is LOGGED vs. what it's CREDITED as.
//
// The stored `load` on a set keeps one canonical meaning per exercise so
// history, progression and PRs stay consistent:
//   • dumbbells (per-hand): the weight of ONE dumbbell (15 = a 15 in each hand)
//   • Smith machine: the TOTAL lifted (both sides' plates + the 25 lb bar)
//   • barbell / EZ bar: the TOTAL including the bar
//   • stacks: the number the pin is in
// The logger shows/accepts the number that's natural at the station (plates on
// one side for the Smith) and converts. `lifted()` is the external weight
// actually moved per rep — what tonnage credit is computed from.
// ---------------------------------------------------------------------------

export type EntryMode = 'per-hand' | 'one-dumbbell' | 'per-side' | 'bar-total' | 'stack' | 'total' | 'bodyweight'

export interface LoadEntry {
  mode: EntryMode
  /** Short unit for the logger column / labels: "lb/hand", "lb/side", "lb". */
  unit: string
  /** One-line "how to log the weight" note shown on the exercise card. */
  howTo: string
  /** Stored load → the number the trainee types. */
  toInput(load: number): number
  /** The number the trainee typed → stored load. */
  fromInput(value: number): number
  /** Stored load → external weight moved per rep (tonnage credit). */
  lifted(load: number): number
  /** Human label for a stored load, e.g. "15 lb/hand" or "35 lb/side (95 total)". */
  format(load: number): string
}

const round1 = (n: number) => Math.round(n * 10) / 10

function plain(mode: EntryMode, howTo: string): LoadEntry {
  return {
    mode, unit: 'lb', howTo,
    toInput: (l) => l, fromInput: (v) => v, lifted: (l) => l,
    format: (l) => `${l} lb`,
  }
}

/** The logging convention for an exercise (by catalog id or record). */
export function loadEntryFor(exercise: string | Exercise | undefined): LoadEntry {
  const ex = typeof exercise === 'string' ? EXERCISES_BY_ID[exercise] : exercise
  if (!ex || ex.loadBasis === 'bodyweight') {
    return { ...plain('bodyweight', ''), unit: '', format: () => 'BW' }
  }
  const eq = EQUIPMENT_BY_ID[ex.equipmentId]

  if (ex.loadBasis === 'per-hand') {
    if (ex.oneHanded) {
      return {
        ...plain('one-dumbbell', 'Log the weight of the one dumbbell you’re holding.'),
        format: (l) => `${l} lb DB`,
      }
    }
    return {
      mode: 'per-hand',
      unit: 'lb/hand',
      howTo: 'Log ONE dumbbell’s weight — “15” means a 15 lb dumbbell in each hand (credited as 30 lb lifted).',
      toInput: (l) => l,
      fromInput: (v) => v,
      lifted: (l) => l * 2,
      format: (l) => `${l} lb/hand`,
    }
  }

  if (eq?.loadType === 'smith') {
    const bar = eq.barWeight ?? 0
    return {
      mode: 'per-side',
      unit: 'lb/side',
      howTo: `Log the plates on ONE side — “35” = 35 lb each side. The app adds both sides + the ${bar} lb bar (35/side → ${35 * 2 + bar} lb total).`,
      toInput: (l) => round1(Math.max(0, (l - bar) / 2)),
      fromInput: (v) => round1(v * 2 + bar),
      lifted: (l) => l,
      format: (l) => `${round1(Math.max(0, (l - bar) / 2))} lb/side (${l} total)`,
    }
  }

  if (eq?.loadType === 'barbell') {
    const bar = eq.barWeight ?? 45
    return plain('bar-total', `Log the TOTAL weight including the ${bar} lb bar (e.g. a 45 plate on each side of a 45 lb bar = 135).`)
  }

  if (eq?.loadType === 'stack') {
    const note = ex.equipmentId === 'hoist-hd3000'
      ? 'Log the weight on the stack’s label as shown — it’s the 2:1 effective resistance you feel.'
      : 'Log the number where the pin is in the stack.'
    return plain('stack', note)
  }

  // kettlebell / sandbag / med ball — one implement, its own weight
  return plain('total', 'Log the weight of the bell/bag you’re using.')
}

/** Tonnage multiplier from reps: per-side lifts do every rep twice (once per side). */
export function sidesOf(exerciseId: string): 1 | 2 {
  return EXERCISES_BY_ID[exerciseId]?.perSide ? 2 : 1
}

/** Total external weight moved across the done working sets of a session's exercises. */
export function tonnage(exercises: { exerciseId: string; sets: { reps: number; load: number | null; done: boolean; warmup?: boolean }[] }[]): number {
  let total = 0
  for (const ex of exercises) {
    const entry = loadEntryFor(ex.exerciseId)
    if (entry.mode === 'bodyweight' || EXERCISES_BY_ID[ex.exerciseId]?.timed) continue
    const sides = sidesOf(ex.exerciseId)
    for (const s of ex.sets) {
      if (!s.done || s.warmup || s.load == null || !Number.isFinite(s.load) || s.load <= 0) continue
      total += entry.lifted(s.load) * s.reps * sides
    }
  }
  return Math.round(total)
}

/** Which body part a per-side rep is counted on, for labels. */
function limbOf(ex: Exercise): 'leg' | 'arm' | 'side' {
  return /lunge|leg|squat|calf/i.test(ex.name) ? 'leg' : /crunch|chop/i.test(ex.name) ? 'side' : 'arm'
}

/** What a "rep" means for an exercise, when it isn't obvious; null when it is. */
export function repMeaning(exerciseId: string): string | null {
  const ex = EXERCISES_BY_ID[exerciseId]
  if (!ex) return null
  const limb = limbOf(ex)
  if (ex.timed && ex.perSide) return 'Timed: hold/walk for the seconds shown on one side, then the same time on the other. Log seconds per side.'
  if (ex.timed) return 'Timed: log the seconds you held or walked as the “reps”.'
  if (ex.perSide) return `1 rep = one ${limb}. Do the full count on each ${limb} (finish one ${limb}, then switch) — log reps per ${limb}.`
  return null
}

/** Short rep unit for labels: "reps", "reps/leg", "sec", "sec/side". */
export function repUnit(exerciseId: string): string {
  const ex = EXERCISES_BY_ID[exerciseId]
  if (!ex) return 'reps'
  if (ex.timed) return ex.perSide ? 'sec/side' : 'sec'
  return ex.perSide ? `reps/${limbOf(ex)}` : 'reps'
}
