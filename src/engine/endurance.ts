import type { GuidedStep, LoadCarriageObjective, PlannedSession, RunEventObjective } from '../domain/types'
import { effectiveTargetDate, weeksSince, weeksUntil } from '../domain/objectives'

// ---------------------------------------------------------------------------
// Date-aware endurance periodization.
//
// Running (Couch-to-5K style → race): build an aerobic base with run/walk
// intervals, graduating to continuous running, then a race-specific
// build → peak → taper as the event approaches. Runs are kept easy and are
// scheduled away from heavy leg days (managed by the weekly planner) to limit
// the concurrent-training "interference effect".
//
// Rucking (loaded carriage → festival): build TIME on feet first, then LOAD,
// peaking with the real pack in the weeks before the event, then a short taper.
// ---------------------------------------------------------------------------

const round5 = (n: number) => Math.round(n / 5) * 5

const WARMUP: GuidedStep = { label: 'Warm-up walk', seconds: 300, instruction: 'Easy brisk walk to warm up the legs and lungs.' }
const COOLDOWN: GuidedStep = { label: 'Cool-down walk', seconds: 300, instruction: 'Easy walk until your breathing settles, then stretch the calves and hips.' }

function run(seconds: number, note = 'Easy, conversational pace.'): GuidedStep {
  return { label: 'Run', seconds, instruction: note }
}
function walk(seconds: number): GuidedStep {
  return { label: 'Walk', seconds, instruction: 'Recovery walk — get your breath back.' }
}
function intervals(runSec: number, walkSec: number, times: number, note?: string): GuidedStep[] {
  const out: GuidedStep[] = []
  for (let i = 0; i < times; i++) { out.push(run(runSec, note ?? 'Easy, conversational pace.')); out.push(walk(walkSec)) }
  return out
}

// --- run: Couch-to-5K base ladder (index 0 = true beginner) -----------------
function ladderBody(stage: number): { body: GuidedStep[]; label: string } {
  switch (Math.max(0, Math.min(7, Math.round(stage)))) {
    case 0: return { label: 'run 1 min / walk 90s ×6', body: intervals(60, 90, 6) }
    case 1: return { label: 'run 90s / walk 2 min ×5', body: intervals(90, 120, 5) }
    case 2: return { label: 'run 3 min / walk 2 min ×4', body: intervals(180, 120, 4) }
    case 3: return { label: 'run 5 min / walk 2 min ×3', body: intervals(300, 120, 3) }
    case 4: return { label: 'run 8 min / walk 2 min ×2 + 5 min', body: [...intervals(480, 120, 2), run(300)] }
    case 5: return { label: 'run 20 min continuous', body: [run(20 * 60)] }
    case 6: return { label: 'run 25 min continuous', body: [run(25 * 60)] }
    default: return { label: 'run 30 min continuous', body: [run(30 * 60)] }
  }
}

/** Where on the ladder to start, given what the trainee can already run. */
function seedStage(baselineRunMinutes: number): number {
  const b = baselineRunMinutes
  if (b >= 30) return 7
  if (b >= 25) return 6
  if (b >= 20) return 5
  if (b >= 10) return 3
  if (b >= 5) return 1
  return 0
}

export type RunPhase = 'base' | 'build' | 'peak' | 'taper' | 'maintenance'

export function runPhase(o: RunEventObjective, now = Date.now()): RunPhase {
  const w = weeksUntil(o.targetDate, now)
  if (w <= 0) return 'maintenance'
  if (w <= 2) return 'taper'
  if (w <= 8) return 'peak'
  if (w <= 20) return 'build'
  return 'base'
}

function estMinutesOf(steps: GuidedStep[]): number {
  const secs = steps.reduce((s, x) => s + (x.seconds ?? (x.reps ?? 8) * 3) * (x.perSide ? 2 : 1) + 5, 0)
  return Math.max(1, Math.round(secs / 60))
}

/**
 * Today's run. `variant` (0..2) lets the weekly planner vary the week's runs
 * once the trainee can run continuously (intervals / easy / long).
 */
export function runSession(o: RunEventObjective, now = Date.now(), variant = 0): PlannedSession {
  const phase = runPhase(o, now)
  let body: GuidedStep[]
  let detail: string

  if (phase === 'base') {
    // Authentic C25K: the same run/walk workout across the week; it advances
    // one rung per week (seeded by current ability), capping at a 30-min run.
    const stage = seedStage(o.baselineRunMinutes) + weeksSince(o.createdAt, now)
    const { body: b, label } = ladderBody(stage)
    body = b
    detail = `Base building • ${label}`
  } else if (phase === 'build') {
    if (variant === 0) { body = [run(18 * 60, 'Steady "comfortably hard" tempo — you could speak only in short phrases.')]; detail = 'Build • 18-min tempo run' }
    else if (variant === 2) { body = [run(38 * 60, 'Easy long run — keep it conversational the whole way.')]; detail = 'Build • long easy run' }
    else { body = [run(26 * 60, 'Easy, conversational pace.')]; detail = 'Build • easy run' }
  } else if (phase === 'peak') {
    if (variant === 0) { body = [...intervals(4 * 60, 2 * 60, 4, 'Faster than 5K pace — strong but controlled.')]; detail = 'Peak • speed intervals (4×4 min)' }
    else if (variant === 2) { body = [run(40 * 60, 'Easy long run to hold your aerobic base.')]; detail = 'Peak • long easy run' }
    else { body = [run(25 * 60, 'Easy recovery pace.')]; detail = 'Peak • easy run' }
  } else if (phase === 'taper') {
    body = [run(15 * 60, 'Short and easy — stay fresh for race day.')]
    detail = 'Taper • short easy run'
  } else {
    body = [run(25 * 60, 'Easy maintenance run to keep your engine.')]
    detail = 'Maintenance • easy run (update your race date)'
  }

  const steps = [WARMUP, ...body, COOLDOWN]
  return {
    kind: 'run',
    title: 'Run',
    detail,
    estMinutes: estMinutesOf(steps),
    objectiveId: o.id,
    attribute: 'grit',
    steps,
  }
}

// --- ruck: progressive loaded walks -----------------------------------------
export type RuckPhase = 'build' | 'peak' | 'taper' | 'maintenance'

export function ruckPhase(o: LoadCarriageObjective, now = Date.now()): RuckPhase {
  const w = weeksUntil(effectiveTargetDate(o, now), now)
  if (w <= 1) return 'taper'
  if (w <= 4) return 'peak'
  return 'build'
}

/** Today's loaded walk. `variant` 2 = the week's longer walk. */
export function ruckSession(o: LoadCarriageObjective, now = Date.now(), variant = 0): PlannedSession {
  const phase = ruckPhase(o, now)
  const elapsed = weeksSince(o.createdAt, now)
  let minutes: number
  let load: number
  let detail: string

  if (phase === 'peak') {
    minutes = variant === 2 ? 60 : 45
    load = o.packLoadLb
    detail = `Peak • ${minutes} min with your full pack (~${load} lb)`
  } else if (phase === 'taper') {
    minutes = 20
    load = round5(o.packLoadLb / 2)
    detail = `Taper • easy ${minutes} min, light load`
  } else {
    // build: grow duration first, then load.
    minutes = Math.min(20 + 5 * elapsed, 50) + (variant === 2 ? 10 : 0)
    load = Math.min(Math.max(5, round5(5 + 3 * elapsed)), o.packLoadLb)
    detail = `Build • ${minutes} min carrying ~${load} lb`
  }

  const near = phase === 'peak'
  const steps: GuidedStep[] = [{
    label: 'Loaded walk',
    seconds: minutes * 60,
    instruction:
      `Walk at a steady, brisk pace carrying ~${load} lb${near ? ' — wear the actual pack you\'ll bring' : ' (a loaded backpack works)'}. ` +
      'Stand tall: ribs down, shoulders back, eyes forward. Stop and reset your posture if your low back starts to round or ache.',
  }]

  return {
    kind: 'ruck',
    title: 'Loaded walk',
    detail,
    estMinutes: minutes,
    objectiveId: o.id,
    attribute: 'core',
    steps,
  }
}
