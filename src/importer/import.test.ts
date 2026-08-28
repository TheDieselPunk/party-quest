import { describe, it, expect } from 'vitest'
import { makeDefaultProfile } from '../domain/defaults'
import { importFromCsv } from './import'

const profile = makeDefaultProfile({ id: 'p1' })

const SAMPLE = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Day A","25 Aug 2026, 18:19","25 Aug 2026, 19:20","","Chest Press (Machine)",,"",0,"warmup",55,6,,,
"Day A","25 Aug 2026, 18:19","25 Aug 2026, 19:20","","Chest Press (Machine)",,"",1,"normal",55,8,,,
"Day A","25 Aug 2026, 18:19","25 Aug 2026, 19:20","","Crunch",,"",0,"normal",,12,,,
"Day A","25 Aug 2026, 18:19","25 Aug 2026, 19:20","","Elliptical Trainer",,"",0,"normal",,,1.3,600,
"Day A","25 Aug 2026, 18:19","25 Aug 2026, 19:20","","Zercher Squat (Barbell)",,"",0,"normal",95,8,,,7
`

describe('importFromCsv', () => {
  it('groups a session and maps/flags sets correctly', () => {
    const { sessions, recognized } = importFromCsv(SAMPLE, profile)
    expect(sessions).toHaveLength(1)
    const s = sessions[0]
    expect(s.title).toBe('Day A')
    expect(s.exercises).toHaveLength(4)

    const press = s.exercises[0]
    expect(press.exerciseId).toBe('machine-chest-press') // recognized → catalog id
    expect(press.sets[0].warmup).toBe(true)
    expect(press.sets[1].warmup).toBeFalsy()
    expect(press.sets[1].load).toBe(55)

    // cardio → minutes as reps, no load
    const cardio = s.exercises.find((e) => /elliptical/i.test(e.name))!
    expect(cardio.sets[0].load).toBeNull()
    expect(cardio.sets[0].reps).toBe(10)

    // unknown exercise → muscles inferred (squat → quads), rpe→rir
    const zercher = s.exercises.find((e) => /zercher/i.test(e.name))!
    expect(zercher.muscles.some((m) => m.muscle === 'quads')).toBe(true)
    expect(zercher.sets[0].rir).toBe(3) // 10 - rpe 7

    expect(recognized).toBeGreaterThanOrEqual(2)
  })
})
