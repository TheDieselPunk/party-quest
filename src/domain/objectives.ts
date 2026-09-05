import type {
  LoadCarriageObjective, Objective, ObjectiveKind, PostureObjective,
  Profile, RunEventObjective,
} from './types'

// ---------------------------------------------------------------------------
// Objective helpers: factories, date math (race countdown / recurring events),
// and small selectors. Objectives are stored on the profile as a plain array.
// ---------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const OBJECTIVE_META: Record<ObjectiveKind, { icon: string; label: string; blurb: string }> = {
  posture: {
    icon: '🪑',
    label: 'Fix my posture',
    blurb: 'Undo "desk posture" — more pulling, thoracic mobility, and a short daily desk reset.',
  },
  'run-event': {
    icon: '🏃',
    label: 'Train for a run',
    blurb: 'Build up to a race by a target date, on your off-gym days, without wrecking your lifting.',
  },
  'load-carriage': {
    icon: '🎒',
    label: 'Carry a pack all day',
    blurb: 'Back & core endurance plus progressive loaded walks so a heavy pack stops hurting.',
  },
}

/** Whole weeks from `from` until `to` (can be negative once the date passes). */
export function weeksUntil(to: number, from = Date.now()): number {
  return Math.round((to - from) / WEEK_MS)
}

/** Whole weeks elapsed since `since` (never negative). */
export function weeksSince(since: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - since) / WEEK_MS))
}

/**
 * The next occurrence of an annual date (month/day). If this year's has already
 * passed, roll to next year. Used to keep a recurring event (e.g. Hulaween)
 * always pointing at the upcoming one.
 */
export function nextAnnualDate(monthIndex: number, day: number, now = Date.now()): number {
  const d = new Date(now)
  const thisYear = new Date(d.getFullYear(), monthIndex, day, 12, 0, 0).getTime()
  return thisYear >= now ? thisYear : new Date(d.getFullYear() + 1, monthIndex, day, 12, 0, 0).getTime()
}

/** Hulaween lands in late October; default to Oct 29 (user-adjustable). */
export function nextHulaween(now = Date.now()): number {
  return nextAnnualDate(9 /* Oct */, 29, now)
}

// --- factories --------------------------------------------------------------
const base = (kind: ObjectiveKind): { id: string; kind: ObjectiveKind; enabled: boolean; createdAt: number } => ({
  id: crypto.randomUUID(),
  kind,
  enabled: true,
  createdAt: Date.now(),
})

export function newPostureObjective(): PostureObjective {
  return { ...base('posture'), kind: 'posture', dailyReset: true }
}

export function newRunEventObjective(overrides: Partial<RunEventObjective> = {}): RunEventObjective {
  return {
    ...base('run-event'),
    kind: 'run-event',
    distanceKm: 5,
    targetDate: Date.now() + 12 * WEEK_MS,
    baselineRunMinutes: 0,
    daysPerWeek: 3,
    ...overrides,
  }
}

export function newLoadCarriageObjective(overrides: Partial<LoadCarriageObjective> = {}): LoadCarriageObjective {
  return {
    ...base('load-carriage'),
    kind: 'load-carriage',
    eventName: 'Festival',
    targetDate: nextHulaween(),
    recurringAnnual: true,
    packLoadLb: 12,
    daysOnFeet: 4,
    ...overrides,
  }
}

// --- selectors --------------------------------------------------------------
export function objectivesOf(profile: Profile): Objective[] {
  return profile.objectives ?? []
}

export function enabledObjectives(profile: Profile): Objective[] {
  return objectivesOf(profile).filter((o) => o.enabled)
}

export function findObjective<K extends ObjectiveKind>(
  profile: Profile,
  kind: K,
): Extract<Objective, { kind: K }> | undefined {
  return enabledObjectives(profile).find((o) => o.kind === kind) as Extract<Objective, { kind: K }> | undefined
}

export function hasObjective(profile: Profile, kind: ObjectiveKind): boolean {
  return !!findObjective(profile, kind)
}

/**
 * Resolve a recurring event's target to the upcoming occurrence. Once the stored
 * date has passed, an annual event rolls forward to next year automatically.
 */
export function effectiveTargetDate(o: LoadCarriageObjective, now = Date.now()): number {
  if (o.targetDate >= now || !o.recurringAnnual) return o.targetDate
  const d = new Date(o.targetDate)
  return nextAnnualDate(d.getMonth(), d.getDate(), now)
}
