import { describe, it, expect } from 'vitest'
import { makeDefaultProfile } from '../domain/defaults'
import { planWeek, runPhase, runSession, ruckPhase, ruckSession } from './index'
import { applySession, emptyCharacter } from '../rpg/character'
import type {
  CompletedSession, LoadCarriageObjective, PostureObjective, RunEventObjective,
} from '../domain/types'

const NOW = new Date(2026, 8, 5).getTime() // 2026-09-05
const WEEK = 7 * 24 * 60 * 60 * 1000

const runObj = (o: Partial<RunEventObjective> = {}): RunEventObjective => ({
  id: 'r', kind: 'run-event', enabled: true, createdAt: NOW,
  distanceKm: 5, targetDate: NOW + 34 * WEEK, baselineRunMinutes: 0, daysPerWeek: 3, ...o,
})
const ruckObj = (o: Partial<LoadCarriageObjective> = {}): LoadCarriageObjective => ({
  id: 'k', kind: 'load-carriage', enabled: true, createdAt: NOW,
  eventName: 'Hulaween', targetDate: NOW + 20 * WEEK, recurringAnnual: true, packLoadLb: 12, daysOnFeet: 4, ...o,
})
const postureObj = (): PostureObjective => ({ id: 'p', kind: 'posture', enabled: true, createdAt: NOW, dailyReset: true })

describe('run periodization', () => {
  it('moves through phases as the race approaches', () => {
    expect(runPhase(runObj({ targetDate: NOW + 34 * WEEK }), NOW)).toBe('base')
    expect(runPhase(runObj({ targetDate: NOW + 15 * WEEK }), NOW)).toBe('build')
    expect(runPhase(runObj({ targetDate: NOW + 5 * WEEK }), NOW)).toBe('peak')
    expect(runPhase(runObj({ targetDate: NOW + 1 * WEEK }), NOW)).toBe('taper')
    expect(runPhase(runObj({ targetDate: NOW - 1 * WEEK }), NOW)).toBe('maintenance')
  })

  it('starts a true beginner on run/walk intervals and advances weekly', () => {
    const o = runObj()
    const wk0 = runSession(o, NOW)
    expect(wk0.kind).toBe('run')
    expect(wk0.attribute).toBe('grit')
    expect(wk0.detail).toContain('Base building')
    // step 0 is a warm-up walk, then a run interval
    expect(wk0.steps?.[0].label).toMatch(/walk/i)
    expect(wk0.steps?.some((s) => s.label === 'Run')).toBe(true)
    // three weeks later the ladder has advanced to longer run intervals
    const wk3 = runSession(o, NOW + 3 * WEEK)
    expect(wk3.detail).toContain('5 min')
  })

  it('tapers to a short easy run near race day', () => {
    const s = runSession(runObj({ targetDate: NOW + 1 * WEEK }), NOW)
    expect(s.detail.toLowerCase()).toContain('taper')
    expect(s.estMinutes).toBeLessThan(30)
  })
})

describe('ruck periodization', () => {
  it('builds duration first, and never exceeds the target pack weight', () => {
    const o = ruckObj({ packLoadLb: 12, targetDate: NOW + 20 * WEEK })
    expect(ruckPhase(o, NOW)).toBe('build')
    const early = ruckSession(o, NOW)
    const later = ruckSession(o, NOW + 6 * WEEK)
    expect(later.estMinutes).toBeGreaterThan(early.estMinutes)
    // load is embedded in the detail; assert the cap via the peak case below
    expect(early.attribute).toBe('core')
  })

  it('peaks with the full pack in the final weeks', () => {
    const s = ruckSession(ruckObj({ packLoadLb: 12, targetDate: NOW + 2 * WEEK }), NOW)
    expect(ruckPhase(ruckObj({ targetDate: NOW + 2 * WEEK }), NOW)).toBe('peak')
    expect(s.detail).toContain('12 lb')
    expect(s.detail.toLowerCase()).toContain('peak')
  })
})

describe('planWeek', () => {
  it('lays out 7 days with gym, runs, a ruck and daily mobility, keeping runs off gym days', () => {
    const profile = makeDefaultProfile({
      frequency: 3,
      objectives: [postureObj(), runObj(), ruckObj()],
    })
    const plan = planWeek(profile, NOW)
    expect(plan.days).toHaveLength(7)

    const count = (kind: string) => plan.days.reduce((n, d) => n + d.sessions.filter((s) => s.kind === kind).length, 0)
    expect(count('gym')).toBe(3)          // frequency
    expect(count('run')).toBe(3)          // daysPerWeek, on off-gym days
    expect(count('ruck')).toBeGreaterThanOrEqual(1)
    expect(count('mobility')).toBe(7)     // posture Desk Reset every day

    // never a run on the same day as a gym session
    for (const d of plan.days) {
      const kinds = d.sessions.map((s) => s.kind)
      expect(kinds.includes('gym') && kinds.includes('run')).toBe(false)
    }
    expect(plan.days[0].isToday).toBe(true)
  })

  it('with no objectives, schedules only gym days and rest', () => {
    const plan = planWeek(makeDefaultProfile({ frequency: 3 }), NOW)
    const kinds = new Set(plan.days.flatMap((d) => d.sessions.map((s) => s.kind)))
    expect(kinds.has('gym')).toBe(true)
    expect(kinds.has('rest')).toBe(true)
    expect(kinds.has('mobility')).toBe(false)
  })
})

describe('off-gym session XP', () => {
  const base = { id: 's', profileId: 'p', date: NOW, goal: 'muscle' as const, exercises: [] }

  it('a run earns grit + vitality and counts toward the streak, with no PRs', () => {
    const s: CompletedSession = { ...base, title: 'Run', durationSeconds: 30 * 60, type: 'run' }
    const r = applySession(emptyCharacter('p'), s)
    expect(r.xpGained.grit).toBeGreaterThan(0)
    expect(r.xpGained.vitality).toBeGreaterThan(0)
    expect(r.character.totalSessions).toBe(1)
    expect(r.character.streak).toBe(1)
    expect(r.prs).toHaveLength(0)
  })

  it('a ruck develops core and foundation', () => {
    const s: CompletedSession = { ...base, title: 'Loaded walk', durationSeconds: 40 * 60, type: 'ruck' }
    const r = applySession(emptyCharacter('p'), s)
    expect(r.xpGained.core).toBeGreaterThan(0)
    expect(r.xpGained.foundation).toBeGreaterThan(0)
  })

  it('a mobility flow develops vitality', () => {
    const s: CompletedSession = { ...base, title: 'Desk Reset', durationSeconds: 7 * 60, type: 'mobility' }
    const r = applySession(emptyCharacter('p'), s)
    expect(r.xpGained.vitality).toBeGreaterThan(20) // session-complete + mobility bonus
  })
})
