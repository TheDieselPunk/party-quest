import type { CompletedSession, Profile } from '../domain/types'
import { findObjective } from '../domain/objectives'
import { runPhase, ruckPhase, runProgress, ruckProgress } from './endurance'

// ---------------------------------------------------------------------------
// Adherence: does the plan match what's actually being logged? Two things live
// here — an *effective* training frequency the plan can adapt to (downward only,
// never rewriting the user's chosen target), and a plain-language summary of
// every adaptation, surfaced in the app AND the Coach report so nothing the
// engine does behind the scenes is a surprise.
// ---------------------------------------------------------------------------

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Gym sessions only — off-day runs/rucks/mobility don't count toward frequency. */
function gymSessions(sessions: CompletedSession[]): CompletedSession[] {
  return sessions.filter((s) => !s.type || s.type === 'gym')
}

export interface EffectiveFrequency {
  /** The user's chosen target (profile.frequency). */
  set: number
  /** How many gym days the plan actually builds around. */
  effective: number
  /** Measured gym sessions per week over the window. */
  avgPerWeek: number
  weeksMeasured: number
  /** True when `effective < set` because of a consistent shortfall. */
  adapting: boolean
}

/**
 * How many gym days to plan around. Adapts DOWNWARD only, and only once there
 * are ~2+ weeks of history showing a consistent shortfall — so the plan meets
 * you where you are instead of endlessly promising days you skip. It never
 * touches profile.frequency (your target); it's derived on the fly and
 * self-corrects back up the moment you start logging more sessions.
 */
export function effectiveFrequency(profile: Profile, sessions: CompletedSession[], now = Date.now()): EffectiveFrequency {
  const WINDOW = 3
  const ageWeeks = Math.max(0, Math.floor((now - profile.createdAt) / WEEK_MS))
  const weeksMeasured = Math.min(WINDOW, ageWeeks)
  const set = profile.frequency
  if (weeksMeasured < 2) return { set, effective: set, avgPerWeek: set, weeksMeasured, adapting: false }

  const since = now - weeksMeasured * WEEK_MS
  const count = gymSessions(sessions).filter((s) => s.date >= since && s.date <= now).length
  const avgPerWeek = count / weeksMeasured
  const rounded = Math.round(avgPerWeek)
  if (rounded >= 2 && rounded <= set - 1) return { set, effective: rounded, avgPerWeek, weeksMeasured, adapting: true }
  return { set, effective: set, avgPerWeek, weeksMeasured, adapting: false }
}

export interface TrainingStatus {
  /** Whole days since the last gym session (null if none logged yet). */
  daysSinceLast: number | null
  gymLast7: number
  target: number
  freq: EffectiveFrequency
}

export function trainingStatus(profile: Profile, sessions: CompletedSession[], now = Date.now()): TrainingStatus {
  const gym = gymSessions(sessions)
  const last = gym.length ? Math.max(...gym.map((s) => s.date)) : null
  const daysSinceLast = last == null ? null : Math.max(0, Math.floor((now - last) / DAY_MS))
  const since7 = now - 7 * DAY_MS
  const gymLast7 = gym.filter((s) => s.date >= since7 && s.date <= now).length
  return { daysSinceLast, gymLast7, target: profile.frequency, freq: effectiveFrequency(profile, sessions, now) }
}

function countFor(sessions: CompletedSession[], kind: 'run' | 'ruck', objId: string, since: number): number {
  return sessions.filter((s) => s.type === kind && s.objectiveId === objId && s.date >= since).length
}

/**
 * Plain-language notes for every place the plan has diverged from the nominal
 * schedule because of what's actually been logged. Empty when the plan is
 * tracking the schedule as set. Consumed by the Dashboard and the Coach report.
 */
export function planAdaptations(profile: Profile, sessions: CompletedSession[], now = Date.now()): string[] {
  const notes: string[] = []

  const freq = effectiveFrequency(profile, sessions, now)
  if (freq.adapting) {
    notes.push(
      `Training frequency: you're set to ${freq.set}×/week but have averaged ~${freq.avgPerWeek.toFixed(1)}×/week ` +
      `over the last ${freq.weeksMeasured} weeks, so the plan is now built around ${freq.effective}×/week. ` +
      `Commit to ${freq.set} or lower your frequency to ${freq.effective} to match.`,
    )
  }

  const run = findObjective(profile, 'run-event')
  if (run && runPhase(run, now) === 'base') {
    const done = countFor(sessions, 'run', run.id, run.createdAt)
    const p = runProgress(run, done, now)
    if (p.behindWeeks >= 1) {
      notes.push(
        `Running: the base ladder is held back — ${done} run${done === 1 ? '' : 's'} logged has earned ` +
        `${p.earnedWeeks} of ~${p.calendarWeeks} weeks of progression (behind by ${p.behindWeeks}). ` +
        `It advances as you log runs and won't skip ahead.`,
      )
    }
  }

  const ruck = findObjective(profile, 'load-carriage')
  if (ruck && ruckPhase(ruck, now) === 'build') {
    const done = countFor(sessions, 'ruck', ruck.id, ruck.createdAt)
    const p = ruckProgress(ruck, done, now)
    if (p.behindWeeks >= 1) {
      notes.push(
        `Loaded walks: the build ramp is held back — ${done} logged has earned ${p.earnedWeeks} of ` +
        `~${p.calendarWeeks} weeks (behind by ${p.behindWeeks}). Duration and load grow as you log walks.`,
      )
    }
  }

  return notes
}

export interface BehindItem { icon: string; label: string }

/**
 * Short, glanceable behind-pace headlines for the Dashboard: days since the
 * last session, an adapted frequency, and any endurance ladder that's lagging.
 * Empty when you're on track — so the card only appears when there's something
 * to catch up on.
 */
export function behindHeadlines(profile: Profile, sessions: CompletedSession[], now = Date.now()): BehindItem[] {
  const out: BehindItem[] = []
  const s = trainingStatus(profile, sessions, now)

  if (s.daysSinceLast != null && s.daysSinceLast >= 3) {
    out.push({ icon: '🗓️', label: `${s.daysSinceLast} days since your last session` })
  }
  if (s.freq.adapting) {
    out.push({ icon: '📉', label: `Planning around ${s.freq.effective}×/week (you set ${s.freq.set})` })
  }

  const run = findObjective(profile, 'run-event')
  if (run && runPhase(run, now) === 'base') {
    const p = runProgress(run, countFor(sessions, 'run', run.id, run.createdAt), now)
    if (p.behindWeeks >= 1) out.push({ icon: '🏃', label: `Runs behind by ${p.behindWeeks} wk — resumes where you left off` })
  }
  const ruck = findObjective(profile, 'load-carriage')
  if (ruck && ruckPhase(ruck, now) === 'build') {
    const p = ruckProgress(ruck, countFor(sessions, 'ruck', ruck.id, ruck.createdAt), now)
    if (p.behindWeeks >= 1) out.push({ icon: '🎒', label: `Loaded walks behind by ${p.behindWeeks} wk` })
  }
  return out
}
