import type { GuidedStep, PlannedSession } from '../domain/types'

// ---------------------------------------------------------------------------
// Guided mobility routines for the posture objective. The "Desk Reset" targets
// the classic desk pattern (upper-cross: forward head, rounded shoulders, stiff
// thoracic; plus tight hip flexors): activate the deep neck flexors, lower traps
// and glutes; open the chest, t-spine and hip flexors. ~7 minutes, safe daily.
// ---------------------------------------------------------------------------

const STEPS: GuidedStep[] = [
  {
    label: 'Chin tucks',
    reps: 10,
    instruction: 'Sitting or standing tall, gently draw your head straight back (make a "double chin"), hold 2s, release. Wakes up the deep neck flexors that fight forward head.',
  },
  {
    label: 'Doorway pec stretch',
    seconds: 30,
    perSide: true,
    instruction: 'Forearm on a doorframe at shoulder height, step through until you feel a stretch across the chest. Opens the tight chest that rounds your shoulders.',
  },
  {
    label: 'Wall slides',
    reps: 10,
    instruction: 'Back to a wall, arms in a "goalpost". Slide them up and down keeping wrists and elbows on the wall. Trains the lower/mid traps to set your shoulders back.',
  },
  {
    label: 'Thoracic extension',
    seconds: 30,
    instruction: 'Hands behind your head, gently arch your upper back over a chair edge (or foam roller). Restores the mid-back extension a desk steals.',
  },
  {
    label: 'Band pull-aparts',
    reps: 15,
    instruction: 'Arms straight, pull a band apart to your chest, squeezing the shoulder blades. (No band? Do prone "T" raises on the floor.)',
  },
  {
    label: 'Kneeling hip-flexor stretch',
    seconds: 30,
    perSide: true,
    instruction: 'Half-kneel, squeeze the down-side glute and shift forward. Lengthens the hip flexors that tilt your pelvis and feed low-back ache.',
  },
  {
    label: 'Glute bridges',
    reps: 12,
    instruction: 'On your back, drive through the heels and squeeze the glutes at the top. Turns on the muscles that stabilize your pelvis and spare your low back.',
  },
  {
    label: 'Cat–cow',
    reps: 8,
    instruction: 'On all fours, alternate rounding and arching the spine, slow and full-range. Finishes with easy segmental spinal mobility.',
  },
]

/** The daily posture Desk Reset as a guided session. */
export function deskResetSession(objectiveId?: string): PlannedSession {
  const est = Math.round(
    STEPS.reduce((s, x) => s + (x.seconds ? x.seconds * (x.perSide ? 2 : 1) : (x.reps ?? 8) * 3) + 12, 0) / 60,
  )
  return {
    kind: 'mobility',
    title: 'Desk Reset',
    detail: 'Posture mobility flow',
    estMinutes: Math.max(5, est),
    objectiveId,
    attribute: 'vitality',
    steps: STEPS,
  }
}
