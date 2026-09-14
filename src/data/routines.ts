import type { GuidedStep, PlannedSession } from '../domain/types'

// ---------------------------------------------------------------------------
// Guided mobility routines for the posture objective. The "Desk Reset" targets
// the classic desk pattern (upper-cross: forward head, rounded shoulders, stiff
// thoracic; plus tight hip flexors): activate the deep neck flexors, lower traps
// and glutes; open the chest, t-spine and hip flexors. ~7 minutes, safe daily.
// With the anterior-pelvic-tilt add-on it also trains posterior pelvic tilt and
// deep-core control (the lower-cross other half).
// ---------------------------------------------------------------------------

const STEPS: GuidedStep[] = [
  {
    label: 'Chin tucks',
    reps: 10,
    art: 'chin-tuck',
    instruction: 'Sitting or standing tall, gently draw your head straight back (make a "double chin"), hold 2s, release. Wakes up the deep neck flexors that fight forward head.',
  },
  {
    label: 'Doorway pec stretch',
    seconds: 30,
    perSide: true,
    art: 'doorway-pec',
    instruction: 'Forearm on a doorframe at shoulder height, step through until you feel a stretch across the chest. Opens the tight chest that rounds your shoulders.',
  },
  {
    label: 'Wall slides',
    reps: 10,
    art: 'wall-slide',
    instruction: 'Back to a wall, arms in a "goalpost". Slide them up and down keeping wrists and elbows on the wall. Trains the lower/mid traps to set your shoulders back.',
  },
  {
    label: 'Thoracic extension',
    seconds: 30,
    art: 'thoracic-extension',
    instruction: 'Hands behind your head, gently arch your upper back over a chair edge (or foam roller). Restores the mid-back extension a desk steals.',
  },
  {
    label: 'Band pull-aparts',
    reps: 15,
    art: 'band-pull-apart',
    instruction: 'Arms straight, pull a band apart to your chest, squeezing the shoulder blades. (No band? Do prone "T" raises on the floor.)',
  },
  {
    label: 'Kneeling hip-flexor stretch',
    seconds: 30,
    perSide: true,
    art: 'hip-flexor',
    instruction: 'Half-kneel, squeeze the down-side glute and shift forward. Lengthens the hip flexors that tilt your pelvis and feed low-back ache.',
  },
  {
    label: 'Glute bridges',
    reps: 12,
    art: 'glute-bridge',
    instruction: 'On your back, drive through the heels and squeeze the glutes at the top. Turns on the muscles that stabilize your pelvis and spare your low back.',
  },
  {
    label: 'Cat–cow',
    reps: 8,
    art: 'cat-cow',
    instruction: 'On all fours, alternate rounding and arching the spine, slow and full-range. Finishes with easy segmental spinal mobility.',
  },
]

// Anterior-pelvic-tilt add-on (Janda lower-crossed). The reset already stretches
// the hip flexors and fires the glutes; these two add the missing half — the
// posterior-pelvic-tilt motor skill and the deep-core strength to hold it.
// Inserted right after the hip-flexor stretch. Text-only for now (no demo clip).
const APT_STEPS: GuidedStep[] = [
  {
    label: 'Posterior pelvic tilts',
    reps: 12,
    instruction: 'On your back, knees bent. Gently flatten your low back into the floor by tucking your tailbone (tilt the pelvis back), hold 3s, release. The core motor skill for undoing an anterior pelvic tilt.',
  },
  {
    label: 'Dead bug',
    reps: 10,
    perSide: true,
    instruction: 'On your back, arms toward the ceiling, knees bent 90°. Keeping your low back pressed flat, slowly lower the opposite arm and leg, then switch sides. Builds the deep core that holds your pelvis level against the tilt.',
  },
]

/** Steps for the reset, optionally with the anterior-pelvic-tilt add-on. */
function resetSteps(anteriorPelvicTilt: boolean): GuidedStep[] {
  if (!anteriorPelvicTilt) return STEPS
  const out: GuidedStep[] = []
  for (const s of STEPS) {
    out.push(s)
    if (s.art === 'hip-flexor') out.push(...APT_STEPS)
  }
  return out
}

/** The daily posture Desk Reset as a guided session. */
export function deskResetSession(objectiveId?: string, opts: { anteriorPelvicTilt?: boolean } = {}): PlannedSession {
  const steps = resetSteps(opts.anteriorPelvicTilt ?? false)
  const est = Math.round(
    steps.reduce((s, x) => s + (x.seconds ? x.seconds * (x.perSide ? 2 : 1) : (x.reps ?? 8) * 3) + 12, 0) / 60,
  )
  return {
    kind: 'mobility',
    title: 'Desk Reset',
    detail: opts.anteriorPelvicTilt ? 'Posture + pelvic-tilt flow' : 'Posture mobility flow',
    estMinutes: Math.max(5, est),
    objectiveId,
    attribute: 'vitality',
    steps,
  }
}
