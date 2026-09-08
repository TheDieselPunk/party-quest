import { describe, it, expect } from 'vitest'
import { makeDefaultProfile } from '../domain/defaults'
import { effectiveFrequency, planAdaptations, behindHeadlines } from './adherence'
import type { CompletedSession, RunEventObjective } from '../domain/types'

const NOW = new Date(2026, 8, 20).getTime()
const WEEK = 7 * 24 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/** `n` gym sessions, most recent first, spaced `spacingDays` apart. */
function gym(n: number, spacingDays = 2): CompletedSession[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `g${i}`, profileId: 'p', date: NOW - i * spacingDays * DAY,
    title: 'Session', goal: 'muscle' as const, exercises: [],
  }))
}

const runObj = (o: Partial<RunEventObjective> = {}): RunEventObjective => ({
  id: 'r', kind: 'run-event', enabled: true, createdAt: NOW - 3 * WEEK,
  distanceKm: 5, targetDate: NOW + 30 * WEEK, baselineRunMinutes: 0, daysPerWeek: 3, ...o,
})

describe('effectiveFrequency', () => {
  it('adapts downward on a persistent shortfall', () => {
    const profile = makeDefaultProfile({ frequency: 5, createdAt: NOW - 4 * WEEK })
    const f = effectiveFrequency(profile, gym(9), NOW) // ~3/week over 3 weeks
    expect(f.adapting).toBe(true)
    expect(f.effective).toBe(3)
    expect(f.set).toBe(5)
  })

  it('does not adapt when the target is being met', () => {
    const profile = makeDefaultProfile({ frequency: 3, createdAt: NOW - 4 * WEEK })
    const f = effectiveFrequency(profile, gym(9), NOW) // ~3/week, meets 3
    expect(f.adapting).toBe(false)
    expect(f.effective).toBe(3)
  })

  it('never adapts upward (over-attendance keeps the set target)', () => {
    const profile = makeDefaultProfile({ frequency: 3, createdAt: NOW - 4 * WEEK })
    const f = effectiveFrequency(profile, gym(15), NOW) // ~5/week
    expect(f.adapting).toBe(false)
    expect(f.effective).toBe(3)
  })

  it('holds off until there are at least ~2 weeks of history', () => {
    const profile = makeDefaultProfile({ frequency: 5, createdAt: NOW - 1 * WEEK })
    const f = effectiveFrequency(profile, gym(1), NOW)
    expect(f.adapting).toBe(false)
    expect(f.effective).toBe(5)
  })

  it('floors the adapted frequency at 2 (a near-zero week is not "1×")', () => {
    const profile = makeDefaultProfile({ frequency: 5, createdAt: NOW - 4 * WEEK })
    const f = effectiveFrequency(profile, gym(3, 6), NOW) // ~1/week → below floor
    expect(f.effective).toBe(5) // stays at the target rather than dropping to 1
    expect(f.adapting).toBe(false)
  })
})

describe('planAdaptations & behindHeadlines', () => {
  it('notes an adapted frequency', () => {
    const profile = makeDefaultProfile({ frequency: 5, createdAt: NOW - 4 * WEEK })
    const notes = planAdaptations(profile, gym(9), NOW)
    expect(notes.some((n) => /frequency/i.test(n) && n.includes('3×/week'))).toBe(true)
  })

  it('notes a run ladder held back by missed sessions', () => {
    const profile = makeDefaultProfile({ frequency: 3, createdAt: NOW - 4 * WEEK, objectives: [runObj()] })
    const notes = planAdaptations(profile, [], NOW) // no runs logged
    expect(notes.some((n) => /running/i.test(n) && /behind by 3/.test(n))).toBe(true)
  })

  it('surfaces a days-since-last headline once you lapse', () => {
    const profile = makeDefaultProfile({ frequency: 3, createdAt: NOW - 4 * WEEK })
    const stale = [{ id: 'g', profileId: 'p', date: NOW - 5 * DAY, title: 'Session', goal: 'muscle' as const, exercises: [] }]
    const items = behindHeadlines(profile, stale, NOW)
    expect(items.some((i) => /5 days since/.test(i.label))).toBe(true)
  })

  it('is quiet when everything is on track', () => {
    const profile = makeDefaultProfile({ frequency: 3, createdAt: NOW - 4 * WEEK })
    const items = behindHeadlines(profile, gym(3, 1), NOW) // trained yesterday-ish, on pace
    expect(items).toHaveLength(0)
  })
})
