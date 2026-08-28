import type {
  CompletedSession, LoggedExercise, LoggedSet, Muscle, MuscleInvolvement, Profile,
} from '../domain/types'
import { EXERCISES_BY_ID } from '../data/exercises'
import { parseCsv } from './csv'

// ---------------------------------------------------------------------------
// Import workout history from another app's CSV export. General-purpose: known
// exercises map to the gym catalog (so progression + PRs carry over); unknown
// ones get muscles inferred from their name so volume/RPG still count.
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseDate(s: string): number {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})[,\s]+(\d{1,2}):(\d{2})/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()] ?? 0
    return new Date(Number(m[3]), mo, Number(m[1]), Number(m[4]), Number(m[5])).getTime()
  }
  const d = Date.parse(s)
  return Number.isNaN(d) ? Date.now() : d
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// Known exercise names → gym catalog ids (movement-first; equipment approximated
// to what the apartment gym has). Progression/PRs seed the mapped catalog lift.
const ALIASES: Record<string, string> = {
  'romanian deadlift (smith machine)': 'smith-rdl',
  'romanian deadlift (barbell)': 'smith-rdl',
  'romanian deadlift (dumbbell)': 'db-rdl',
  'deadlift (barbell)': 'smith-rdl',
  'chest press (machine)': 'machine-chest-press',
  'bench press (smith machine)': 'smith-bench',
  'bench press (barbell)': 'smith-bench',
  'bench press (dumbbell)': 'db-flat-press',
  'incline bench press (dumbbell)': 'incline-db-press',
  'single arm cable row': 'cable-row',
  'seated cable row': 'cable-row',
  'bent over row (smith machine)': 'smith-row',
  'bent over row (barbell)': 'smith-row',
  'lat pulldown (cable)': 'lat-pulldown',
  'straight arm lat pulldown (cable)': 'cable-straight-arm',
  'chest fly (dumbbell)': 'db-fly',
  'cable fly crossovers': 'cable-fly',
  'triceps pushdown': 'cable-pushdown',
  'lateral raise (dumbbell)': 'db-lateral-raise',
  'shoulder press (dumbbell)': 'db-shoulder-press',
  'bicep curl (dumbbell)': 'db-curl',
  'leg press (machine)': 'leg-press',
  'leg press horizontal (machine)': 'leg-press',
  'standing calf raise (dumbbell)': 'smith-calf',
  'standing calf raise (smith)': 'smith-calf',
  'cable crunch': 'ab-crunch',
  'crunch': 'decline-situp',
  'elliptical trainer': 'elliptical-intervals',
  'treadmill': 'treadmill-intervals',
  'cycling': 'bike-intervals',
}

const CARDIO_RE = /elliptical|treadmill|cycling|\bbike\b|running|\brun\b|walk|stair|erg|rowing machine/

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Infer muscles from an exercise name when it isn't in the catalog. */
function inferMuscles(name: string): MuscleInvolvement[] {
  const n = ` ${name.toLowerCase()} `
  const P = (m: Muscle, role: 'primary' | 'secondary' = 'primary'): MuscleInvolvement => ({ muscle: m, role })
  if (/calf|calve/.test(n)) return [P('calves')]
  if (/leg curl|hamstring/.test(n)) return [P('hamstrings')]
  if (/leg extension|quad/.test(n)) return [P('quads')]
  if (/squat|leg press|lunge|split squat/.test(n)) return [P('quads'), P('glutes', 'secondary')]
  if (/deadlift|hip thrust|romanian|\brdl\b|good morning|hinge|swing/.test(n)) return [P('hamstrings'), P('glutes'), P('back', 'secondary')]
  if (/glute|hip abduction|hip adduction/.test(n)) return [P('glutes')]
  if (/tricep|pushdown|skull|dip|overhead extension|kickback/.test(n)) return [P('triceps')]
  if (/lateral raise|rear delt|face pull|reverse fly/.test(n)) return [P('shoulders')]
  if (/shoulder press|overhead press|\bohp\b|military|arnold/.test(n)) return [P('shoulders'), P('triceps', 'secondary')]
  if (/\bcurl\b|bicep/.test(n)) return [P('biceps')]
  if (/row|pulldown|pull-?up|pull up|chin-?up|chin up|\blat\b|shrug/.test(n)) return [P('back'), P('biceps', 'secondary')]
  if (/bench|chest|\bfly\b|push-?up|push up|\bpress\b|pec/.test(n)) return [P('chest'), P('triceps', 'secondary'), P('shoulders', 'secondary')]
  if (/crunch|sit-?up|situp|\bab\b|abs|plank|hang|hanging|leg raise|woodchop|rotation|oblique/.test(n)) return [P('core')]
  return []
}

export interface MappedExercise {
  exerciseId: string
  name: string
  equipmentId: string
  muscles: MuscleInvolvement[]
  cardio: boolean
  recognized: boolean
}

function mapExercise(title: string): MappedExercise {
  const key = norm(title)
  const aliasId = ALIASES[key]
  if (aliasId && EXERCISES_BY_ID[aliasId]) {
    const ex = EXERCISES_BY_ID[aliasId]
    return { exerciseId: ex.id, name: title, equipmentId: ex.equipmentId, muscles: ex.muscles, cardio: ex.kind === 'conditioning', recognized: true }
  }
  // direct name match to a catalog exercise
  const direct = Object.values(EXERCISES_BY_ID).find((e) => norm(e.name) === key)
  if (direct) {
    return { exerciseId: direct.id, name: title, equipmentId: direct.equipmentId, muscles: direct.muscles, cardio: direct.kind === 'conditioning', recognized: true }
  }
  if (CARDIO_RE.test(key)) {
    return { exerciseId: 'imported-cardio', name: title, equipmentId: 'elliptical', muscles: [], cardio: true, recognized: false }
  }
  return { exerciseId: `imported-${slug(title)}`, name: title, equipmentId: 'imported', muscles: inferMuscles(title), cardio: false, recognized: false }
}

function targetOf(muscles: MuscleInvolvement[]): Muscle {
  return muscles.find((m) => m.role === 'primary')?.muscle ?? muscles[0]?.muscle ?? 'core'
}

export interface ImportResult {
  sessions: CompletedSession[]
  recognized: number
  unrecognizedNames: string[]
  /** Fraction of loaded working sets done in ≤6 reps (a strength-style signal). */
  lowRepFraction: number
  /** True when the logged style looks strength-oriented (suggest the Strength goal). */
  suggestsStrength: boolean
}

/** Parse a CSV export into CompletedSession objects for a profile. */
export function importFromCsv(text: string, profile: Profile): ImportResult {
  const rows = parseCsv(text)
  // group by session (unique start_time), preserving order
  const order: string[] = []
  const byStart = new Map<string, Record<string, string>[]>()
  for (const r of rows) {
    const k = r['start_time'] || r['title'] || ''
    if (!byStart.has(k)) { byStart.set(k, []); order.push(k) }
    byStart.get(k)!.push(r)
  }

  const sessions: CompletedSession[] = []
  const recognizedIds = new Set<string>()
  const unrecognized = new Set<string>()

  for (const k of order) {
    const rs = byStart.get(k)!
    const first = rs[0]
    const date = parseDate(first['start_time'] || '')
    const end = parseDate(first['end_time'] || '')
    const durationSeconds = end > date ? Math.round((end - date) / 1000) : undefined

    const exercises: LoggedExercise[] = []
    let cur: LoggedExercise | null = null
    let curTitle = ''

    for (const r of rs) {
      const title = r['exercise_title'] || 'Exercise'
      if (title !== curTitle || !cur) {
        const map = mapExercise(title)
        if (map.recognized) recognizedIds.add(map.exerciseId); else unrecognized.add(title)
        cur = { exerciseId: map.exerciseId, name: title, equipmentId: map.equipmentId, targetMuscle: targetOf(map.muscles), muscles: map.muscles, sets: [] }
        ;(cur as LoggedExercise & { _cardio?: boolean })._cardio = map.cardio
        exercises.push(cur)
        curTitle = title
      }
      const cardio = (cur as LoggedExercise & { _cardio?: boolean })._cardio
      const weight = r['weight_lbs'] !== '' ? Number(r['weight_lbs']) : null
      const repsRaw = r['reps'] !== '' ? Number(r['reps']) : 0
      const dur = r['duration_seconds'] !== '' ? Number(r['duration_seconds']) : 0
      const rpe = r['rpe'] !== '' ? Number(r['rpe']) : null
      const set: LoggedSet = {
        reps: cardio ? Math.max(1, Math.round(dur / 60)) : (repsRaw || dur || 0),
        load: cardio ? null : (Number.isFinite(weight as number) ? weight : null),
        rir: rpe != null ? Math.max(0, Math.round(10 - rpe)) : null,
        done: true,
        warmup: (r['set_type'] || '').toLowerCase() === 'warmup',
      }
      cur.sets.push(set)
    }
    // strip helper flag
    for (const e of exercises) delete (e as LoggedExercise & { _cardio?: boolean })._cardio

    sessions.push({
      id: crypto.randomUUID(),
      profileId: profile.id,
      date,
      title: first['title'] || 'Imported workout',
      goal: profile.goal,
      exercises,
      durationSeconds,
    })
  }

  // Glean training style: how often are loaded sets taken in ≤6 reps?
  let loaded = 0
  let lowRep = 0
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.warmup || set.load == null || set.load <= 0 || set.reps <= 0) continue
        loaded++
        if (set.reps <= 6) lowRep++
      }
    }
  }
  const lowRepFraction = loaded ? lowRep / loaded : 0

  return {
    sessions,
    recognized: recognizedIds.size,
    unrecognizedNames: [...unrecognized],
    lowRepFraction,
    suggestsStrength: lowRepFraction >= 0.35,
  }
}
