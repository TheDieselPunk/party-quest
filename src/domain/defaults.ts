import type { Profile } from './types'

/** A new profile with sensible, research-aligned defaults. */
export function makeDefaultProfile(overrides: Partial<Profile> = {}): Profile {
  const goal = overrides.goal ?? 'muscle'
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: 'Adventurer',
    characterName: 'Adventurer',
    createdAt: Date.now(),

    goal,
    // Passing `goal` alone (e.g. in tests) implies a single-goal `goals`, so it
    // doesn't silently disagree with the field callers actually set.
    goals: overrides.goals ?? [goal],
    experience: 'intermediate',
    frequency: 3,
    sessionMinutes: 60,
    focus: null,
    location: 'gym',

    units: 'lb',
    avoidMuscles: [],
    avoidPatterns: [],
    warmup: true,
    rirTarget: 2,
    restAutostart: true,
    sound: true,
    keepAwake: true,
    deloadWeeks: 8,
    cardio: 'none',
    splitStyle: 'auto',

    dayIndex: 0,
    ...overrides,
  }
}

/**
 * Guarantee a valid, non-empty `goals` array + a `goal` that agrees with it.
 * Profiles saved before multi-goal selection shipped only have `goal` on
 * disk — this backfills `goals` from it on read so every consumer can rely
 * on `goals` being present.
 */
export function normalizeProfile(p: Profile): Profile {
  if (p.goals && p.goals.length) return p.goal === p.goals[0] ? p : { ...p, goal: p.goals[0] }
  return { ...p, goals: [p.goal] }
}
