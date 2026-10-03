import { describe, it, expect } from 'vitest'
import { makeDefaultProfile } from '../domain/defaults'
import { generateWorkout, estimateSessionSeconds } from './generate'
import { snapLoad, recommendLoad, type LastPerf } from './weight'
import { weeklyVolumeTargets, volumeFromSessions } from './volume'
import { EXERCISES_BY_ID } from '../data/exercises'
import type { CompletedSession } from '../domain/types'

describe('snapLoad', () => {
  it('snaps dumbbells to the nearest available pair', () => {
    expect(snapLoad('dumbbell', 32)).toBe(30)
    expect(snapLoad('dumbbell', 33)).toBe(35)
    expect(snapLoad('dumbbell', 999)).toBe(50) // clamped to heaviest pair
  })
  it('snaps to the HD-3300’s actual stepped stack, not a flat increment', () => {
    // Real stack: 10,25,40,55,70,85,100,115,135,155,175,195,215 (+15 then +20 steps).
    expect(snapLoad('hoist-hd3300', 94)).toBe(100)
    expect(snapLoad('hoist-hd3300', 3)).toBe(10) // min
  })
})

describe('recommendLoad (double progression)', () => {
  const ex = EXERCISES_BY_ID['machine-chest-press']
  it('estimates and flags calibration the first time', () => {
    const rec = recommendLoad(ex, 'intermediate', [8, 12], 2, undefined)
    expect(rec.calibration).toBe(true)
    expect(rec.load).toBe(85) // baseLoad 90 snaps down to the nearest stack step
  })
  it('adds a step after hitting the top of the range on all sets', () => {
    const last: LastPerf = { load: 90, repsPerSet: [12, 12, 12], rir: 2 }
    const rec = recommendLoad(ex, 'intermediate', [8, 12], 2, last)
    expect(rec.load).toBe(115) // next stack step up from 90 (100, then +1 step)
    expect(rec.calibration).toBe(false)
  })
  it('holds the load when reps are mid-range', () => {
    const last: LastPerf = { load: 90, repsPerSet: [10, 9, 8], rir: 1 }
    expect(recommendLoad(ex, 'intermediate', [8, 12], 2, last).load).toBe(90)
  })
  it('backs off after missing the bottom of the range', () => {
    const last: LastPerf = { load: 90, repsPerSet: [6, 5, 5], rir: 0 }
    expect(recommendLoad(ex, 'intermediate', [8, 12], 2, last).load).toBe(85) // next stack step down from 90
  })
  it('returns null for bodyweight moves', () => {
    expect(recommendLoad(EXERCISES_BY_ID['plank'], 'intermediate', [10, 20], 2, undefined).load).toBeNull()
  })
})

describe('weeklyVolumeTargets', () => {
  it('scales with experience and strength goal', () => {
    const beg = weeklyVolumeTargets(makeDefaultProfile({ experience: 'beginner' }))
    const adv = weeklyVolumeTargets(makeDefaultProfile({ experience: 'advanced' }))
    expect(adv.chest).toBeGreaterThan(beg.chest)
    const str = weeklyVolumeTargets(makeDefaultProfile({ goal: 'strength' }))
    const hyp = weeklyVolumeTargets(makeDefaultProfile({ goal: 'muscle' }))
    expect(str.chest).toBeLessThan(hyp.chest)
  })
  it('boosts the focused region and zeroes avoided muscles', () => {
    const t = weeklyVolumeTargets(makeDefaultProfile({ focus: 'chest', avoidMuscles: ['calves'] }))
    const base = weeklyVolumeTargets(makeDefaultProfile())
    expect(t.chest).toBeGreaterThan(base.chest)
    expect(t.calves).toBe(0)
  })
})

describe('volumeFromSessions (0.5 indirect rule)', () => {
  it('counts secondary muscles as half a set', () => {
    const session: CompletedSession = {
      id: 's1', profileId: 'p', date: Date.now(), title: 't', goal: 'muscle',
      exercises: [{
        exerciseId: 'machine-chest-press', name: 'Chest Press', equipmentId: 'hoist-hd3300',
        targetMuscle: 'chest', muscles: EXERCISES_BY_ID['machine-chest-press'].muscles,
        sets: [
          { reps: 10, load: 90, rir: 2, done: true },
          { reps: 10, load: 90, rir: 2, done: true },
        ],
      }],
    }
    const v = volumeFromSessions([session])
    expect(v.chest).toBe(2) // primary → full
    expect(v.triceps).toBe(1) // secondary → 0.5 × 2 sets
  })
})

describe('generateWorkout', () => {
  const profile = makeDefaultProfile()

  it('produces a plausible ordered session', () => {
    const plan = generateWorkout(profile, { busy: true })
    expect(plan.exercises.length).toBeGreaterThan(3)
    // Session opens with a compound (hardest first).
    const firstClass = EXERCISES_BY_ID[plan.exercises[0].exerciseId].repClass
    expect(['heavy-compound', 'compound']).toContain(firstClass)
    // Conditioning, if present, finishes the session.
    const condIdx = plan.exercises.findIndex((pe) => pe.kind === 'conditioning')
    if (condIdx >= 0) expect(condIdx).toBe(plan.exercises.length - 1)
  })

  it('fits roughly within the requested time budget', () => {
    for (const minutes of [40, 60, 80]) {
      const plan = generateWorkout(makeDefaultProfile({ sessionMinutes: minutes }), { busy: true })
      const mins = estimateSessionSeconds(plan.exercises, { warmupBlock: true }) / 60
      expect(mins).toBeGreaterThan(minutes * 0.7)
      expect(mins).toBeLessThan(minutes * 1.25)
      expect(plan.estMinutes).toBe(Math.round(mins))
    }
  })

  it('a 60-min plan holds ~14–18 working sets (calibrated to real logged sessions)', () => {
    // David's real full-body sessions: ~19 working sets took ~75 min of lifting.
    for (const goal of ['strength', 'muscle'] as const) {
      for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
        const plan = generateWorkout(makeDefaultProfile({ goal, sessionMinutes: 60 }), { busy: true, dayIndex })
        const working = plan.exercises.reduce((n, pe) => n + pe.sets.filter((s) => !s.warmup).length, 0)
        expect(working).toBeGreaterThanOrEqual(12)
        expect(working).toBeLessThanOrEqual(18)
      }
    }
  })

  it('counts unilateral moves twice and station changeovers', () => {
    const plan = generateWorkout(makeDefaultProfile({ sessionMinutes: 60 }), { busy: true })
    const one = plan.exercises.find((pe) => !pe.supersetGroup)!
    const base = estimateSessionSeconds([one])
    const asLunge = estimateSessionSeconds([{ ...one, exerciseId: 'db-lunge' }])
    expect(asLunge).toBeGreaterThan(base)
    expect(estimateSessionSeconds([one, { ...one }])).toBe(base * 2) // each station costs a changeover
  })

  it('gives every non-cardio exercise recommended weights or a bodyweight note', () => {
    const plan = generateWorkout(profile)
    for (const pe of plan.exercises) {
      const ex = EXERCISES_BY_ID[pe.exerciseId]
      if (ex.loadBasis !== 'bodyweight' && ex.baseLoad != null && ex.kind !== 'conditioning') {
        expect(pe.sets.some((s) => s.load != null)).toBe(true)
      }
    }
  })

  it('supersets the two stations of a dual machine when both are used', () => {
    // Lower day tends to use leg extension + leg curl (same HD-3400 unit).
    const plan = generateWorkout(makeDefaultProfile({ frequency: 4, dayIndex: 1 }))
    const dual = plan.exercises.filter((pe) => pe.equipmentId === 'hoist-hd3400')
    if (dual.length >= 2) {
      expect(dual[0].supersetGroup).toBeDefined()
      expect(dual[0].supersetGroup).toBe(dual[1].supersetGroup)
      expect(dual[0].supersetKind).toBe('same-unit')
    }
  })

  it('appends conditioning for a fat-loss goal', () => {
    const plan = generateWorkout(makeDefaultProfile({ goal: 'fatloss' }))
    expect(plan.exercises.some((pe) => pe.kind === 'conditioning')).toBe(true)
  })

  it('every prescribed exercise carries alternatives where they exist', () => {
    const plan = generateWorkout(profile)
    const withAlts = plan.exercises.filter((pe) => pe.altIds.length > 0)
    expect(withAlts.length).toBeGreaterThan(0)
  })
})
