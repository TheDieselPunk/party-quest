import type { MovementPattern, Muscle, Profile, SplitStyle } from '../domain/types'

// ---------------------------------------------------------------------------
// Session skeletons. Each training day is a list of "slots" (a movement pattern
// + the muscle it serves). Slots are listed hardest→easiest (de Salles 2012),
// and accessory/optional slots are the first to be trimmed under a time budget.
//
// A/B/C and Upper/Lower/PPL variants deliberately use DIFFERENT patterns for the
// same muscle across the week (Fonseca 2014) — e.g. squat vs. lunge, flat vs.
// incline press — which is the evidence-based way to add variety.
// ---------------------------------------------------------------------------

export interface Slot {
  patterns: MovementPattern[] // acceptable patterns, in preference order
  muscle: Muscle
  role: 'primary' | 'accessory'
  optional?: boolean
}

export interface DayTemplate {
  key: string
  label: string
  slots: Slot[]
}

const p = (patterns: MovementPattern[], muscle: Muscle, role: 'primary' | 'accessory', optional = false): Slot =>
  ({ patterns, muscle, role, optional })

// --- Full body A/B/C --------------------------------------------------------
const FULL_A: DayTemplate = {
  key: 'fb-a', label: "Vanguard's March (Full Body A)",
  slots: [
    p(['squat'], 'quads', 'primary'),
    p(['horizontal-push'], 'chest', 'primary'),
    p(['horizontal-pull', 'vertical-pull'], 'back', 'primary'),
    p(['hinge', 'knee-flexion'], 'hamstrings', 'primary'),
    p(['vertical-push', 'lateral-raise'], 'shoulders', 'accessory'),
    p(['core-flexion', 'core-anti-extension'], 'core', 'accessory'),
    p(['elbow-flexion'], 'biceps', 'accessory', true),
    p(['elbow-extension'], 'triceps', 'accessory', true),
    p(['calf-raise'], 'calves', 'accessory', true),
  ],
}

const FULL_B: DayTemplate = {
  key: 'fb-b', label: "Ranger's Path (Full Body B)",
  slots: [
    p(['hinge'], 'hamstrings', 'primary'),
    p(['incline-push', 'horizontal-push'], 'chest', 'primary'),
    p(['vertical-pull', 'horizontal-pull'], 'back', 'primary'),
    p(['lunge', 'squat'], 'quads', 'primary'),
    p(['lateral-raise', 'vertical-push'], 'shoulders', 'accessory'),
    p(['core-anti-extension', 'core-rotation'], 'core', 'accessory'),
    p(['elbow-extension'], 'triceps', 'accessory', true),
    p(['hip-abduction'], 'glutes', 'accessory', true),
    p(['elbow-flexion'], 'biceps', 'accessory', true),
  ],
}

const FULL_C: DayTemplate = {
  key: 'fb-c', label: "Templar's Trial (Full Body C)",
  slots: [
    p(['squat'], 'quads', 'primary'),
    p(['horizontal-pull'], 'back', 'primary'),
    p(['horizontal-push', 'incline-push'], 'chest', 'primary'),
    p(['hinge'], 'glutes', 'primary'),
    p(['vertical-push'], 'shoulders', 'accessory'),
    p(['core-rotation', 'core-flexion'], 'core', 'accessory'),
    p(['elbow-flexion'], 'biceps', 'accessory', true),
    p(['elbow-extension'], 'triceps', 'accessory', true),
    p(['calf-raise'], 'calves', 'accessory', true),
  ],
}

// --- Upper / Lower ----------------------------------------------------------
const UPPER: DayTemplate = {
  key: 'upper', label: "Highguard (Upper Body)",
  slots: [
    p(['horizontal-push'], 'chest', 'primary'),
    p(['horizontal-pull', 'vertical-pull'], 'back', 'primary'),
    p(['vertical-push'], 'shoulders', 'primary'),
    p(['vertical-pull', 'horizontal-pull'], 'back', 'accessory'),
    p(['lateral-raise'], 'shoulders', 'accessory'),
    p(['elbow-flexion'], 'biceps', 'accessory'),
    p(['elbow-extension'], 'triceps', 'accessory'),
    p(['rear-delt'], 'shoulders', 'accessory', true),
  ],
}

const LOWER: DayTemplate = {
  key: 'lower', label: "Deepstance (Lower Body)",
  slots: [
    p(['squat'], 'quads', 'primary'),
    p(['hinge'], 'hamstrings', 'primary'),
    p(['knee-extension'], 'quads', 'accessory'),
    p(['knee-flexion'], 'hamstrings', 'accessory'),
    p(['hip-abduction'], 'glutes', 'accessory'),
    p(['calf-raise'], 'calves', 'accessory'),
    p(['core-flexion', 'core-anti-extension'], 'core', 'accessory', true),
  ],
}

// --- Push / Pull / Legs -----------------------------------------------------
const PUSH: DayTemplate = {
  key: 'push', label: "Ironfist (Push)",
  slots: [
    p(['horizontal-push'], 'chest', 'primary'),
    p(['vertical-push'], 'shoulders', 'primary'),
    p(['incline-push'], 'chest', 'accessory'),
    p(['lateral-raise'], 'shoulders', 'accessory'),
    p(['elbow-extension'], 'triceps', 'accessory'),
    p(['elbow-extension'], 'triceps', 'accessory', true),
  ],
}

const PULL: DayTemplate = {
  key: 'pull', label: "Longbow (Pull)",
  slots: [
    p(['vertical-pull'], 'back', 'primary'),
    p(['horizontal-pull'], 'back', 'primary'),
    p(['rear-delt'], 'shoulders', 'accessory'),
    p(['elbow-flexion'], 'biceps', 'accessory'),
    p(['elbow-flexion'], 'biceps', 'accessory', true),
    p(['core-anti-extension'], 'core', 'accessory', true),
  ],
}

const LEGS: DayTemplate = {
  key: 'legs', label: "Bulwark (Legs)",
  slots: [
    p(['squat'], 'quads', 'primary'),
    p(['hinge'], 'hamstrings', 'primary'),
    p(['knee-extension'], 'quads', 'accessory'),
    p(['knee-flexion'], 'hamstrings', 'accessory'),
    p(['hip-abduction'], 'glutes', 'accessory'),
    p(['calf-raise'], 'calves', 'accessory'),
  ],
}

/** Which family of splits to use. */
function resolveStyle(style: SplitStyle, frequency: number): 'fullbody' | 'upperlower' | 'ppl' {
  if (style !== 'auto') return style
  if (frequency <= 3) return 'fullbody'
  if (frequency === 4) return 'upperlower'
  return 'ppl'
}

/** The ordered list of distinct day templates the trainee rotates through. */
export function splitDays(profile: Pick<Profile, 'splitStyle' | 'frequency'>): DayTemplate[] {
  switch (resolveStyle(profile.splitStyle, profile.frequency)) {
    case 'upperlower':
      return [UPPER, LOWER]
    case 'ppl':
      return [PUSH, PULL, LEGS]
    case 'fullbody':
    default:
      return [FULL_A, FULL_B, FULL_C]
  }
}

export function dayForIndex(profile: Pick<Profile, 'splitStyle' | 'frequency'>, dayIndex: number): DayTemplate {
  const days = splitDays(profile)
  return days[((dayIndex % days.length) + days.length) % days.length]
}
