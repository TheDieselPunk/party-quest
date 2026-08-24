import type { Profile } from './types'

/** A new profile with sensible, research-aligned defaults. */
export function makeDefaultProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: 'Adventurer',
    characterName: 'Adventurer',
    createdAt: Date.now(),

    goal: 'muscle',
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
    deloadWeeks: 8,
    cardio: 'none',
    splitStyle: 'auto',

    dayIndex: 0,
    ...overrides,
  }
}
