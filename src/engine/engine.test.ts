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
  it('rounds stack machines to their increment and clamps to range', () => {
    expect(snapLoad('hoist-hd3300', 91)).toBe(90) // 5 lb steps
    expect(snapLoad('hoist-hd3300', 3)).toBe(10) // min
  })
})

describe('recommendLoad (double progression)', () => {
  const ex = EXERCISES_BY_ID['machine-chest-press']
  it('estimates and flags calibration the first time', () => {
    const rec = recommendLoad(ex, 'intermediate', [8, 12], 2, undefined)
    expect(rec.calibration).toBe(true)
    expect(rec.load).toBe(90)
  })
  it('adds a step after hitting the top of the range on all sets', () => {
    const last: LastPerf = { load: 90, repsPerSet: [12, 12, 12], rir: 2 }
    const rec = recommendLoad(ex, 'intermediate', [8, 12], 2, last)
    expect(rec.load).toBe(95) // HD-3300 steps 5 lb (David's unit has the add-on)
    expect(rec.calibration).toBe(false)
  })
  it('holds the load when reps are mid-range', () => {
    const last: LastPerf = { load: 90, repsPerSet: [10, 9, 8], rir: 1 }
    expect(recommendLoad(ex, 'intermediate', [8, 12], 2, last).load).toBe(90)
  })
  it('backs off after missing the bottom of the range', () => {
    const last: LastPerf = { load: 90, repsPerSet: [6, 5, 5], rir: 0 }
    expect(recommendLoad(ex, 'intermediate', [8, 12], 2, last).load).toBe(85)
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
      const mins = estimateSessionSeconds(plan.exercises) / 60
      expect(mins).toBeGreaterThan(minutes * 0.7)
      expect(mins).toBeLessThan(minutes * 1.25)
    }
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
