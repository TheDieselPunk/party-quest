import type { Goal, Experience, RepClass } from '../domain/types'

// ---------------------------------------------------------------------------
// Tunable parameters derived from the sports-medicine references the user
// supplied. Centralised here so the "why" stays visible and adjustable.
// ---------------------------------------------------------------------------

/** Weekly sets per muscle, base by experience (Baz-Valle 2022: ~10–20). */
export const BASE_WEEKLY_SETS: Record<Experience, number> = {
  beginner: 10,
  intermediate: 14,
  advanced: 18,
}

/** Goal modifier on total volume. Strength trades volume for intensity. */
export const GOAL_VOLUME_MULT: Record<Goal, number> = {
  strength: 0.8,
  muscle: 1.0,
  fatloss: 1.0,
  other: 1.0,
}

/** Extra volume share for a focused region. */
export const FOCUS_MULT = 1.4

/** Working sets per exercise by role & experience. */
export function setsForExercise(
  repClass: RepClass,
  experience: Experience,
  role: 'primary' | 'accessory',
): number {
  if (repClass === 'conditioning') {
    return { beginner: 3, intermediate: 4, advanced: 5 }[experience]
  }
  const isMainCompound = (repClass === 'heavy-compound' || repClass === 'compound') && role === 'primary'
  if (isMainCompound) {
    return { beginner: 3, intermediate: 3, advanced: 4 }[experience]
  }
  // accessory compounds, isolation, core
  return { beginner: 2, intermediate: 3, advanced: 3 }[experience]
}

export interface RepPrescription {
  reps: [number, number]
  restSeconds: number
}

// Rep range + rest by goal × exercise class.
// Muscle: 6–15 hypertrophy ranges, ~1.5–2 min rest (Schoenfeld 2021).
// Strength: heavy low reps, long rest (Murphy 2024; Schoenfeld 2016 rest).
// Fat loss: same reps as muscle, shorter rest for density (Helms 2015).
const MUSCLE: Record<RepClass, RepPrescription> = {
  'heavy-compound': { reps: [8, 12], restSeconds: 150 },
  compound: { reps: [8, 12], restSeconds: 120 },
  isolation: { reps: [10, 15], restSeconds: 75 },
  core: { reps: [10, 20], restSeconds: 60 },
  conditioning: { reps: [1, 1], restSeconds: 45 },
}

const STRENGTH: Record<RepClass, RepPrescription> = {
  'heavy-compound': { reps: [4, 6], restSeconds: 180 },
  compound: { reps: [6, 8], restSeconds: 150 },
  isolation: { reps: [8, 12], restSeconds: 90 },
  core: { reps: [8, 15], restSeconds: 60 },
  conditioning: { reps: [1, 1], restSeconds: 60 },
}

const FATLOSS: Record<RepClass, RepPrescription> = {
  'heavy-compound': { reps: [8, 12], restSeconds: 105 },
  compound: { reps: [8, 12], restSeconds: 90 },
  isolation: { reps: [10, 15], restSeconds: 60 },
  core: { reps: [12, 20], restSeconds: 45 },
  conditioning: { reps: [1, 1], restSeconds: 30 },
}

export function repPrescription(goal: Goal, repClass: RepClass): RepPrescription {
  const table = goal === 'strength' ? STRENGTH : goal === 'fatloss' ? FATLOSS : MUSCLE
  return table[repClass]
}

/**
 * Rep/rest prescription honoring multiple selected goals: the primary goal
 * (goals[0]) still drives the rep range as before, but a non-primary
 * "strength" pick nudges rest longer (more recovery for the next heavy
 * effort) since Strength's whole edge over Muscle/Fat Loss is rest length.
 */
export function repPrescriptionForProfile(
  profile: { goal: Goal; goals: Goal[] },
  repClass: RepClass,
): RepPrescription {
  const rx = repPrescription(profile.goal, repClass)
  const secondaryStrength = profile.goals.length > 1 && profile.goal !== 'strength' && profile.goals.includes('strength')
  if (!secondaryStrength) return rx
  return { ...rx, restSeconds: Math.round(rx.restSeconds * 1.2) }
}

/** Load scaling for a first-time estimate relative to the intermediate baseLoad. */
export const EXPERIENCE_LOAD_FACTOR: Record<Experience, number> = {
  beginner: 0.6,
  intermediate: 1.0,
  advanced: 1.25,
}

// --- Session timing ---------------------------------------------------------
// Calibrated against David's real logged sessions (12 full-body workouts,
// Jul–Aug 2026): ~19 working + ~4 warm-up sets over 6–8 exercises took a median
// ~83 min including a 10-min cardio warm-up — i.e. ~3.2 min per set all-in.
// The old model only counted reps + prescribed rest, so it ran ~30% short (a
// "60-min" plan took ~78). The real-world overheads it was missing are below.

/** Estimated seconds to perform one set: reps at ~3 s each + getting set (grip, brace, log it). */
export function setWorkSeconds(reps: [number, number], opts: { perSide?: boolean; timed?: boolean } = {}): number {
  const avg = (reps[0] + reps[1]) / 2
  const work = opts.timed ? avg : avg * 3 // timed holds/carries prescribe seconds, not reps
  return Math.round(work * (opts.perSide ? 2 : 1)) + SET_SETUP_SECONDS + (opts.perSide ? 10 : 0)
}

/** Getting into position, re-racking, and logging each set. */
export const SET_SETUP_SECONDS = 25

/** Moving to the next station: walk over, adjust the seat/pin/pulley, load plates, find dumbbells. */
export const EXERCISE_CHANGEOVER_SECONDS = 75

/** The general warm-up before lifting (easy cardio + dynamic mobility). */
export const WARMUP_BLOCK_SECONDS = 5 * 60

/** Rest after a ramp-up (warm-up) set — short, it's not a working set. */
export const WARMUP_SET_REST_SECONDS = 60

/** Timed holds/carries (plank, farmer's carry) are prescribed in seconds. */
export const TIMED_HOLD_SECONDS: [number, number] = [30, 45]

/** Short rest taken between the two movements of a superset. */
export const SUPERSET_TRANSITION_SECONDS = 20

/** A single conditioning "round" is roughly this long, incl. its rest. */
export const CONDITIONING_ROUND_SECONDS = 90
