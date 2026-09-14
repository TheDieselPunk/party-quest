import type { LoggedSet, WorkoutPlan } from './types'

/** An in-progress workout, persisted so it survives a phone lock / reload. */
export interface ActiveWorkout {
  profileId: string
  startedAt: number
  plan: WorkoutPlan
  /** Logged sets aligned to plan.exercises[i].sets[j]. */
  logs: LoggedSet[][]
  /** When the session timer was paused (ms); undefined = running. */
  pausedAt?: number
  /** Accumulated paused time (ms) across earlier pauses. */
  pausedTotalMs?: number
}

/** Session time actually spent training — total elapsed minus any paused time. */
export function elapsedMs(active: ActiveWorkout, now = Date.now()): number {
  const paused = (active.pausedTotalMs ?? 0) + (active.pausedAt != null ? now - active.pausedAt : 0)
  return Math.max(0, now - active.startedAt - paused)
}

/** Seed editable log rows from a freshly generated plan. */
export function logsFromPlan(plan: WorkoutPlan): LoggedSet[][] {
  return plan.exercises.map((pe) =>
    pe.sets.map((s) => ({
      reps: s.reps[1], // suggest the top of the range
      load: s.load,
      rir: null,
      done: false,
      warmup: s.warmup,
    })),
  )
}
