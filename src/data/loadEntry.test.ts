import { describe, it, expect } from 'vitest'
import { loadEntryFor, tonnage, repMeaning, repUnit } from './loadEntry'
import { EXERCISES } from './exercises'
import { buildHistoryIndex, snapLoad, recommendLoad } from '../engine/weight'
import { EXERCISES_BY_ID } from './exercises'

describe('load logging conventions', () => {
  it('dumbbells log ONE dumbbell and credit both hands', () => {
    const e = loadEntryFor('db-shoulder-press')
    expect(e.unit).toBe('lb/hand')
    expect(e.fromInput(15)).toBe(15) // stored as typed
    expect(e.lifted(15)).toBe(30) // 15 in each hand
  })

  it('a one-arm dumbbell row credits the single dumbbell', () => {
    expect(loadEntryFor('db-row').lifted(45)).toBe(45)
  })

  it('the Smith takes plates per side and stores the total incl. the 25 lb bar', () => {
    const e = loadEntryFor('smith-bench')
    expect(e.unit).toBe('lb/side')
    expect(e.fromInput(45)).toBe(115) // 45 each side + 25 bar
    expect(e.toInput(115)).toBe(45)
    expect(e.fromInput(37.5)).toBe(100)
    expect(e.toInput(e.fromInput(2.5))).toBe(2.5)
    expect(e.fromInput(0)).toBe(25) // empty bar is a real set
    expect(e.format(95)).toBe('35 lb/side (95 total)')
  })

  it('barbells are logged as the total including the bar', () => {
    const e = loadEntryFor('barbell-back-squat')
    expect(e.mode).toBe('bar-total')
    expect(e.lifted(135)).toBe(135)
  })

  it('tonnage doubles per-hand loads and per-side reps, skips junk', () => {
    const t = tonnage([
      { exerciseId: 'db-shoulder-press', sets: [{ reps: 10, load: 15, done: true }] }, // 2×15×10 = 300
      { exerciseId: 'db-lunge', sets: [{ reps: 8, load: 20, done: true }] }, // 2×20×8×2 legs = 640
      { exerciseId: 'leg-press', sets: [{ reps: 10, load: NaN, done: true }, { reps: 10, load: 200, done: false }] },
    ])
    expect(t).toBe(940)
  })
})

describe('what a rep means', () => {
  it('unilateral moves count per side', () => {
    expect(repUnit('db-lunge')).toBe('reps/leg')
    expect(repMeaning('db-lunge')).toMatch(/1 rep = one leg/)
    expect(repUnit('db-row')).toBe('reps/arm')
    expect(repMeaning('leg-press')).toBeNull()
  })
  it('timed holds are logged in seconds', () => {
    expect(repUnit('plank')).toBe('sec')
    expect(repUnit('suitcase-carry')).toBe('sec/side')
  })
})

describe('cable attachments', () => {
  it('every cable-machine exercise names its attachment', () => {
    const cable = EXERCISES.filter((e) => e.equipmentId === 'hoist-hd3000')
    expect(cable.length).toBeGreaterThan(0)
    for (const e of cable) expect(e.attachment, e.id).toBeTruthy()
  })
})

describe('stepped weight stacks', () => {
  it('HD-3200 snaps to its measured stack', () => {
    expect(snapLoad('hoist-hd3200', 90)).toBe(95)
    expect(snapLoad('hoist-hd3200', 130)).toBe(125)
    expect(snapLoad('hoist-hd3200', 5)).toBe(20)
  })
})

describe('NaN can never become a recommendation', () => {
  it('ignores a corrupt logged weight and falls back to an estimate', () => {
    const index = buildHistoryIndex([{
      date: 1, exercises: [{ exerciseId: 'low-back-ext', sets: [{ reps: 12, load: NaN, rir: NaN, done: true }] }],
    }])
    expect(index['low-back-ext'].load).toBeNull()
    expect(index['low-back-ext'].rir).toBeNull()
    const rec = recommendLoad(EXERCISES_BY_ID['low-back-ext'], 'intermediate', [10, 15], 2, index['low-back-ext'])
    expect(Number.isFinite(rec.load)).toBe(true)
    expect(rec.calibration).toBe(true)
  })
  it('snapLoad never returns NaN', () => {
    expect(Number.isFinite(snapLoad('hoist-hd3600', NaN))).toBe(true)
  })
})
