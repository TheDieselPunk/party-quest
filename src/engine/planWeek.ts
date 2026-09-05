import type { DayPlan, PlannedSession, Profile, WeekPlan } from '../domain/types'
import { findObjective } from '../domain/objectives'
import { dayForIndex } from './templates'
import { runSession, ruckSession } from './endurance'
import { deskResetSession } from '../data/routines'

// ---------------------------------------------------------------------------
// The weekly planner: turns a profile's objectives + training frequency into a
// concrete 7-day layout starting today. Gym days come from the split; runs go on
// off-gym days (kept off heavy-leg days to limit interference); loaded walks
// take remaining free days; the posture Desk Reset is offered every day.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Which day offsets (0=today) are gym days, spaced for recovery. */
function gymDayPattern(frequency: number): number[] {
  const table: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  }
  if (table[frequency]) return table[frequency]
  const f = Math.max(1, Math.min(7, frequency))
  return Array.from({ length: f }, (_, i) => Math.round((i * 7) / f))
}

/** Pick `count` items spread as evenly as possible across `days`. */
function pickSpread(days: number[], count: number): number[] {
  if (count >= days.length) return [...days]
  if (count <= 0) return []
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(days[Math.round((i * (days.length - 1)) / (count - 1 || 1))])
  return [...new Set(out)]
}

function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function planWeek(profile: Profile, now = Date.now()): WeekPlan {
  const startDate = startOfDay(now)
  const gymDays = gymDayPattern(profile.frequency)

  const runObj = findObjective(profile, 'run-event')
  const ruckObj = findObjective(profile, 'load-carriage')
  const postureObj = findObjective(profile, 'posture')

  const all = [0, 1, 2, 3, 4, 5, 6]
  const offGym = all.filter((d) => !gymDays.includes(d))

  const runDays = runObj ? pickSpread(offGym, Math.min(runObj.daysPerWeek, offGym.length)) : []
  const freeForRuck = offGym.filter((d) => !runDays.includes(d))
  const ruckCount = ruckObj ? Math.min(Math.max(freeForRuck.length ? 1 : 0, ruckObj.daysOnFeet >= 3 ? 2 : 1), freeForRuck.length) : 0
  const ruckDays = ruckObj ? pickSpread(freeForRuck, ruckCount) : []

  const days: DayPlan[] = []
  let gymK = 0
  let runK = 0
  let ruckK = 0

  for (const offset of all) {
    const dayTs = startDate + offset * DAY_MS
    const sessions: PlannedSession[] = []

    if (gymDays.includes(offset)) {
      const day = dayForIndex(profile, profile.dayIndex + gymK)
      sessions.push({
        kind: 'gym',
        title: day.label,
        detail: `${profile.sessionMinutes}-min strength session`,
        estMinutes: profile.sessionMinutes,
      })
      gymK++
    }

    if (runObj && runDays.includes(offset)) {
      // Vary the week's runs: first = quality, last = long, middle = easy.
      const variant = runK === 0 ? 0 : runK === runDays.length - 1 ? 2 : 1
      sessions.push(runSession(runObj, dayTs, variant))
      runK++
    }

    if (ruckObj && ruckDays.includes(offset)) {
      const variant = ruckK === ruckDays.length - 1 ? 2 : 0
      sessions.push(ruckSession(ruckObj, dayTs, variant))
      ruckK++
    }

    if (postureObj?.dailyReset) {
      sessions.push(deskResetSession(postureObj.id))
    }

    if (sessions.length === 0) {
      sessions.push({ kind: 'rest', title: 'Rest', detail: 'Recovery day — walk, hydrate, sleep well.', estMinutes: 0 })
    }

    const weekday = WEEKDAYS[new Date(dayTs).getDay()]
    days.push({ offset, weekday, isToday: offset === 0, sessions })
  }

  return { startDate, days }
}
