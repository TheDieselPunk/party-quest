import type { GuidedStep, PlannedSession } from '../domain/types'

// ---------------------------------------------------------------------------
// Guided mobility routines for the posture objective. The "Desk Reset" targets
// the classic desk pattern (upper-cross: forward head, rounded shoulders, stiff
// thoracic; plus tight hip flexors): deep neck-flexor ENDURANCE (a hold, not
// reps — that's the trained quality), serratus + lower trap for scapular
// upward rotation, mid-trap/rear delt, and glutes; open the chest, t-spine and
// hip flexors. ~10 minutes, safe daily. With the anterior-pelvic-tilt add-on it
// also trains ribs-down breathing, posterior pelvic tilt and deep-core control
// (the lower-cross other half).
// ---------------------------------------------------------------------------

const STEPS: GuidedStep[] = [
  {
    label: 'Chin-tuck hold',
    seconds: 30,
    art: 'chin-tuck',
    instruction: 'Draw your head straight back into a "double chin" and HOLD, breathing normally, eyes level. The deep neck flexors are endurance muscles, so the hold is the point — build toward a solid 30s. Lying on your back with the head resting down is the harder progression.',
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
    label: 'Push-up plus (serratus)',
    reps: 10,
    instruction: 'From a push-up position (on your knees is fine), keep the elbows straight and push the floor away so the shoulder blades spread apart, then let them settle back together. Only those last few inches — that\'s the serratus, which upward-rotates the shoulder blade so your shoulders can actually sit back.',
  },
  {
    label: 'Prone Y-raise (lower trap)',
    reps: 10,
    instruction: 'Face-down on the floor, arms overhead in a wide "Y", thumbs pointing up. Lift the arms a few inches WITHOUT shrugging — think of sliding the shoulder blades down your back. No weight needed; the lower trap is small and control is the point.',
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

// Hip-health add-on (pain from lateral/rotational load — dance, cutting sports).
// The reset already opens the hip flexors and fires the glutes; these add hip
// internal/external rotation mobility, glute-medius activation (the ab/rotation
// stabilizer that's often the weak link behind lateral hip pain), and a deep
// rotator (piriformis) stretch. Inserted right after glute bridges. Text-only
// for now (no demo clip).
const HIP_STEPS: GuidedStep[] = [
  {
    label: '90/90 hip switches',
    reps: 8,
    instruction: 'Sit with front shin perpendicular to your body and back shin mirrored behind, both knees bent 90°. Lift the knees and rotate both legs to switch sides, front leg becoming back. Trains hip internal/external rotation through a full, controlled range.',
  },
  {
    label: 'Clamshells',
    reps: 15,
    perSide: true,
    instruction: 'Lying on your side, knees bent ~45°, feet together. Keeping hips stacked, open the top knee like a clamshell, squeezing the outer glute, then lower with control. Trains glute medius — the hip stabilizer that\'s usually the weak link in lateral hip pain.',
  },
  {
    label: 'Figure-4 stretch',
    seconds: 30,
    perSide: true,
    instruction: 'On your back, cross one ankle over the opposite knee, then pull the uncrossed thigh toward your chest until you feel a stretch deep in the crossed hip. Lengthens the deep hip rotators (piriformis) that guard a sore hip.',
  },
]

// Anterior-pelvic-tilt add-on (Janda lower-crossed). The reset already stretches
// the hip flexors and fires the glutes; these two add the missing half — the
// posterior-pelvic-tilt motor skill and the deep-core strength to hold it.
// Inserted right after the hip-flexor stretch. Text-only for now (no demo clip).
const APT_STEPS: GuidedStep[] = [
  {
    label: 'Ribs-down breathing',
    seconds: 60,
    instruction: 'On your back, knees bent. Exhale slowly and fully through pursed lips and feel your front ribs settle DOWN toward your pelvis — then keep them there as you breathe quietly in through your nose, into your lower ribs and back. This sets the ribs-over-pelvis stack that the tilt and dead-bug work below depend on.',
  },
  {
    label: 'Posterior pelvic tilts',
    reps: 12,
    art: 'posterior-pelvic-tilt',
    instruction: 'On your back, knees bent. Gently flatten your low back into the floor by tucking your tailbone (tilt the pelvis back), hold 3s, release. The core motor skill for undoing an anterior pelvic tilt.',
  },
  {
    label: 'Dead bug',
    reps: 10,
    perSide: true,
    art: 'dead-bug',
    instruction: 'On your back, arms toward the ceiling, knees bent 90°. Keeping your low back pressed flat, slowly lower the opposite arm and leg, then switch sides. Builds the deep core that holds your pelvis level against the tilt.',
  },
]

/** Steps for the reset, optionally with the anterior-pelvic-tilt and/or hip-health add-ons. */
function resetSteps(anteriorPelvicTilt: boolean, hipHealth: boolean): GuidedStep[] {
  const out: GuidedStep[] = []
  for (const s of STEPS) {
    out.push(s)
    if (s.art === 'hip-flexor' && anteriorPelvicTilt) out.push(...APT_STEPS)
    if (s.art === 'glute-bridge' && hipHealth) out.push(...HIP_STEPS)
  }
  return out
}

/** The daily posture Desk Reset as a guided session. */
export function deskResetSession(
  objectiveId?: string, opts: { anteriorPelvicTilt?: boolean; hipHealth?: boolean } = {},
): PlannedSession {
  const steps = resetSteps(opts.anteriorPelvicTilt ?? false, opts.hipHealth ?? false)
  const est = Math.round(
    steps.reduce((s, x) => s + (x.seconds ? x.seconds * (x.perSide ? 2 : 1) : (x.reps ?? 8) * 3) + 12, 0) / 60,
  )
  const extras = [opts.anteriorPelvicTilt && 'pelvic-tilt', opts.hipHealth && 'hip'].filter(Boolean)
  return {
    kind: 'mobility',
    title: 'Desk Reset',
    detail: extras.length ? `Posture + ${extras.join(' + ')} flow` : 'Posture mobility flow',
    estMinutes: Math.max(5, est),
    objectiveId,
    attribute: 'vitality',
    steps,
  }
}
