import type { Muscle, MuscleFocus, Profile, CompletedSession } from '../domain/types'
import { ALL_MUSCLES } from '../domain/types'
import { BASE_WEEKLY_SETS, GOAL_VOLUME_MULT, FOCUS_MULT } from './params'

// ---------------------------------------------------------------------------
// Weekly volume: target sets per muscle (drives how much work to program) and
// actual sets performed (primary = 1 set, secondary = 0.5 set, per Zourdos 2024).
// ---------------------------------------------------------------------------

export function focusToMuscles(focus: MuscleFocus | null): Muscle[] {
  switch (focus) {
    case 'arms': return ['biceps', 'triceps']
    case 'legs': return ['quads', 'hamstrings', 'glutes', 'calves']
    case 'chest': return ['chest']
    case 'back': return ['back']
    case 'shoulders': return ['shoulders']
    case 'core': return ['core']
    default: return []
  }
}

/** Target weekly sets per muscle from experience, goal, focus, and avoid list. */
export function weeklyVolumeTargets(
  profile: Pick<Profile, 'experience' | 'goal' | 'focus' | 'avoidMuscles'>,
): Record<Muscle, number> {
  const base = BASE_WEEKLY_SETS[profile.experience] * GOAL_VOLUME_MULT[profile.goal]
  const focused = new Set(focusToMuscles(profile.focus))
  const avoided = new Set(profile.avoidMuscles)

  const out = {} as Record<Muscle, number>
  for (const m of ALL_MUSCLES) {
    if (avoided.has(m)) { out[m] = 0; continue }
    let sets = base
    if (focused.has(m)) sets *= FOCUS_MULT
    // Arms accrue substantial indirect volume from presses/pulls; trim direct target.
    if (m === 'biceps' || m === 'triceps') sets *= 0.7
    out[m] = Math.round(sets)
  }
  return out
}

/** Sets performed per muscle across the given sessions (0.5 for secondary). */
export function volumeFromSessions(sessions: CompletedSession[]): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>
  for (const m of ALL_MUSCLES) out[m] = 0
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const working = ex.sets.filter((set) => set.done && !set.warmup).length
      if (!working) continue
      for (const mi of ex.muscles) {
        out[mi.muscle] += working * (mi.role === 'primary' ? 1 : 0.5)
      }
    }
  }
  return out
}

/** Sessions within the last `days` days (default 7). */
export function recentSessions(sessions: CompletedSession[], days = 7, now = Date.now()): CompletedSession[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  return sessions.filter((s) => s.date >= cutoff)
}
