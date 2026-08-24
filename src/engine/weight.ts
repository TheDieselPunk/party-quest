import type { Exercise, Experience } from '../domain/types'
import { EQUIPMENT_BY_ID } from '../data/equipment'
import { EXPERIENCE_LOAD_FACTOR } from './params'

// ---------------------------------------------------------------------------
// Weight recommendation: snap loads to what the gym actually offers, seed a
// first-time estimate, and apply double progression from logged history.
// ---------------------------------------------------------------------------

/** Most recent performance of an exercise, distilled for progression logic. */
export interface LastPerf {
  load: number | null
  /** reps achieved on each working set */
  repsPerSet: number[]
  /** representative reps-in-reserve on the last set, if logged */
  rir: number | null
}

export type HistoryIndex = Record<string, LastPerf>

/** Round a desired load to the nearest achievable value for its equipment. */
export function snapLoad(equipmentId: string, desired: number): number {
  const eq = EQUIPMENT_BY_ID[equipmentId]
  if (!eq) return Math.round(desired)

  if (eq.fixedLoads && eq.fixedLoads.length) {
    // dumbbells / kettlebells: nearest discrete plate
    return eq.fixedLoads.reduce((best, v) =>
      Math.abs(v - desired) < Math.abs(best - desired) ? v : best,
    )
  }

  const step = eq.increment ?? 5
  let snapped = Math.round(desired / step) * step
  if (eq.minLoad != null) snapped = Math.max(eq.minLoad, snapped)
  if (eq.maxLoad != null) snapped = Math.min(eq.maxLoad, snapped)
  return snapped
}

/** One progression step up (or down) for a piece of equipment. */
function stepLoad(equipmentId: string, load: number, dir: 1 | -1): number {
  const eq = EQUIPMENT_BY_ID[equipmentId]
  if (!eq) return load
  if (eq.fixedLoads && eq.fixedLoads.length) {
    const sorted = [...eq.fixedLoads].sort((a, b) => a - b)
    const i = sorted.findIndex((v) => v >= load)
    const idx = i < 0 ? sorted.length - 1 : i
    const next = Math.min(Math.max(idx + dir, 0), sorted.length - 1)
    return sorted[next]
  }
  const step = eq.increment ?? 5
  return snapLoad(equipmentId, load + dir * step)
}

export interface LoadRecommendation {
  load: number | null
  calibration: boolean
  reason: string
}

/**
 * Recommend a working load for `exercise` given the target rep range and the
 * trainee's last performance. Implements double progression (Krzysztofik 2019):
 * hit the top of the range on all sets → add a step; badly miss → back off a step.
 */
export function recommendLoad(
  exercise: Exercise,
  experience: Experience,
  repRange: [number, number],
  rirTarget: number,
  last: LastPerf | undefined,
): LoadRecommendation {
  if (exercise.loadBasis === 'bodyweight' || exercise.baseLoad == null) {
    return { load: null, calibration: false, reason: 'bodyweight / self-selected resistance' }
  }

  // First time: estimate from baseline scaled by experience, mark to calibrate.
  if (!last || last.load == null) {
    const est = snapLoad(exercise.equipmentId, exercise.baseLoad * EXPERIENCE_LOAD_FACTOR[experience])
    return {
      load: est,
      calibration: true,
      reason: 'first time — estimate; adjust so the last rep is ~2 short of failure',
    }
  }

  const [lo, hi] = repRange
  const minReps = last.repsPerSet.length ? Math.min(...last.repsPerSet) : 0
  const hitTop = minReps >= hi
  const hadReserve = last.rir == null || last.rir >= rirTarget

  if (hitTop && hadReserve) {
    return {
      load: stepLoad(exercise.equipmentId, last.load, 1),
      calibration: false,
      reason: `hit ${hi} reps on all sets last time → +1 step`,
    }
  }
  if (minReps > 0 && minReps < lo) {
    return {
      load: stepLoad(exercise.equipmentId, last.load, -1),
      calibration: false,
      reason: 'missed the bottom of the range last time → back off a step',
    }
  }
  return {
    load: last.load,
    calibration: false,
    reason: 'hold the load and add reps toward the top of the range',
  }
}

/** Build a lookup of the latest performance per exercise from session history. */
export function buildHistoryIndex(
  sessions: { date: number; exercises: { exerciseId: string; sets: { reps: number; load: number | null; rir: number | null; done: boolean; warmup?: boolean }[] }[] }[],
): HistoryIndex {
  const byDate = [...sessions].sort((a, b) => b.date - a.date)
  const index: HistoryIndex = {}
  for (const session of byDate) {
    for (const ex of session.exercises) {
      if (index[ex.exerciseId]) continue // keep the most recent only
      const working = ex.sets.filter((s) => s.done && !s.warmup)
      if (!working.length) continue
      const loads = working.map((s) => s.load).filter((v): v is number => v != null)
      index[ex.exerciseId] = {
        load: loads.length ? Math.max(...loads) : null,
        repsPerSet: working.map((s) => s.reps),
        rir: working[working.length - 1]?.rir ?? null,
      }
    }
  }
  return index
}
