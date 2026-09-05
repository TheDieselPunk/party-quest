// ---------------------------------------------------------------------------
// Core domain types for the RPG-themed, equipment-tailored training engine.
// This module is pure data/types — no React, no IO. It is the shared language
// used by the engine, the database, the RPG layer, and the UI.
// ---------------------------------------------------------------------------

// --- Muscles we track (Arms = biceps + triceps for the "focus" selector) ----
export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'

export const ALL_MUSCLES: Muscle[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
]

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
}

// --- Movement patterns: used for exercise-variety and ordering rules --------
export type MovementPattern =
  | 'horizontal-push'
  | 'incline-push'
  | 'vertical-push'
  | 'horizontal-pull'
  | 'vertical-pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'knee-extension'
  | 'knee-flexion'
  | 'hip-abduction'
  | 'hip-adduction'
  | 'calf-raise'
  | 'elbow-flexion'
  | 'elbow-extension'
  | 'lateral-raise'
  | 'rear-delt'
  | 'core-flexion'
  | 'core-anti-extension'
  | 'core-rotation'
  | 'back-extension'
  | 'conditioning'

// --- Exercise kind: drives ordering and rep/rest prescription ---------------
export type ExerciseKind = 'compound' | 'isolation' | 'core' | 'conditioning'

// A finer intensity class used for rep-range / rest lookups.
export type RepClass =
  | 'heavy-compound'
  | 'compound'
  | 'isolation'
  | 'core'
  | 'conditioning'

// --- Profile settings -------------------------------------------------------
export type Goal = 'strength' | 'muscle' | 'fatloss' | 'other'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type MuscleFocus = 'core' | 'chest' | 'arms' | 'legs' | 'shoulders' | 'back'
export type LocationId = 'gym' | 'studio'
export type Units = 'lb' | 'kg'
export type CardioLevel = 'none' | 'light' | 'moderate' | 'high'
export type SplitStyle = 'auto' | 'fullbody' | 'upperlower' | 'ppl'

// --- Equipment --------------------------------------------------------------
export type LoadType =
  | 'dumbbell'
  | 'kettlebell'
  | 'stack'
  | 'smith'
  | 'barbell'
  | 'bodyweight'
  | 'band'
  | 'cardio'

export interface EquipmentMode {
  id: string
  name: string
  /** Setup guidance shown in the workout player: "what mode to use". */
  setup: string
}

export interface Equipment {
  id: string
  name: string
  locations: LocationId[]
  loadType: LoadType
  /** True if it is a station that another gym-goer can occupy. */
  isMachine: boolean
  /** Weight step for stack/smith machines (lb). */
  increment?: number
  minLoad?: number
  maxLoad?: number
  /** Discrete available loads (dumbbells / kettlebells), lb. */
  fixedLoads?: number[]
  modes?: EquipmentMode[]
  notes?: string
}

// --- Exercises --------------------------------------------------------------
export interface MuscleInvolvement {
  muscle: Muscle
  /** 'primary' counts as a full set for that muscle, 'secondary' as 0.5. */
  role: 'primary' | 'secondary'
}

export interface Exercise {
  id: string
  name: string
  equipmentId: string
  /** Which station/mode of a multi-function machine this movement uses. */
  modeId?: string
  kind: ExerciseKind
  pattern: MovementPattern
  /** First primary entry is treated as the "target" muscle. */
  muscles: MuscleInvolvement[]
  repClass: RepClass
  /** How the prescribed load is interpreted for logging/estimation. */
  loadBasis: 'per-hand' | 'total' | 'bodyweight'
  /** Ordered fallback exercises (usually different equipment). */
  altIds?: string[]
  cues?: string
  /**
   * Baseline working load (lb) for a first-time intermediate trainee, used to
   * seed the calibration estimate. Scaled by experience. Omit for bodyweight.
   */
  baseLoad?: number
}

// --- Prescription (engine output) ------------------------------------------
export interface PrescribedSet {
  /** Inclusive rep range [low, high]. */
  reps: [number, number]
  /** Recommended load (lb). null => calibrate this session / bodyweight. */
  load: number | null
  warmup?: boolean
  calibration?: boolean
}

export interface PrescribedExercise {
  exerciseId: string
  name: string
  equipmentId: string
  equipmentName: string
  modeId?: string
  modeName?: string
  modeSetup?: string
  kind: ExerciseKind
  targetMuscle: Muscle
  muscles: MuscleInvolvement[]
  sets: PrescribedSet[]
  restSeconds: number
  cues?: string
  altIds: string[]
  /** Exercises sharing a supersetGroup are performed as a superset. */
  supersetGroup?: number
  supersetKind?: 'same-unit' | 'antagonist'
  /** Short rest taken between the paired movements of a superset. */
  transitionSeconds?: number
  /** Reason this exercise was chosen (for transparency / coach export). */
  rationale?: string
}

export interface WorkoutPlan {
  id: string
  profileId: string
  createdAt: number
  title: string
  dayLabel: string
  goal: Goal
  estMinutes: number
  busy: boolean
  warmup: string[]
  exercises: PrescribedExercise[]
}

// --- Profile ----------------------------------------------------------------
export interface Profile {
  id: string
  name: string
  characterName: string
  createdAt: number

  goal: Goal
  goalOther?: string
  experience: Experience
  frequency: number
  sessionMinutes: number
  focus: MuscleFocus | null
  location: LocationId

  units: Units
  avoidMuscles: Muscle[]
  avoidPatterns: MovementPattern[]
  warmup: boolean
  rirTarget: number
  restAutostart: boolean
  sound: boolean
  deloadWeeks: number
  cardio: CardioLevel
  splitStyle: SplitStyle

  /** Rotation bookkeeping: which day of the split to generate next. */
  dayIndex: number
  weekStart?: number

  /** Concurrent real-life training objectives layered on top of the base goal. */
  objectives?: Objective[]

  /** Last local mutation time (ms); used for cloud last-write-wins sync. */
  updatedAt?: number
}

// --- Logged data ------------------------------------------------------------
export interface LoggedSet {
  reps: number
  load: number | null
  rir: number | null
  done: boolean
  warmup?: boolean
}

export interface LoggedExercise {
  exerciseId: string
  name: string
  equipmentId: string
  targetMuscle: Muscle
  muscles: MuscleInvolvement[]
  sets: LoggedSet[]
}

export interface CompletedSession {
  id: string
  profileId: string
  planId?: string
  date: number
  title: string
  goal: Goal
  exercises: LoggedExercise[]
  durationSeconds?: number
  /** Off-gym sessions (mobility/run/ruck) carry a type; gym sessions omit it. */
  type?: SessionType
  /** Which objective this session served (off-gym sessions). */
  objectiveId?: string
  updatedAt?: number
}

// --- RPG --------------------------------------------------------------------
export type Attribute = 'might' | 'power' | 'foundation' | 'core' | 'grit' | 'vitality'

export const ALL_ATTRIBUTES: Attribute[] = [
  'might', 'power', 'foundation', 'core', 'grit', 'vitality',
]

export const ATTRIBUTE_LABEL: Record<Attribute, string> = {
  might: 'Might',
  power: 'Power',
  foundation: 'Foundation',
  core: 'Core',
  grit: 'Grit',
  vitality: 'Vitality',
}

export const ATTRIBUTE_BLURB: Record<Attribute, string> = {
  might: 'Pushing strength — chest, shoulders, triceps',
  power: 'Pulling strength — back, biceps',
  foundation: 'Lower body — quads, hamstrings, glutes, calves',
  core: 'Trunk — abs and lower back',
  grit: 'Conditioning, work capacity, and consistency',
  vitality: 'Adherence and recovery discipline',
}

/** Which attribute a muscle's training volume feeds. */
export const MUSCLE_TO_ATTRIBUTE: Record<Muscle, Attribute> = {
  chest: 'might',
  shoulders: 'might',
  triceps: 'might',
  back: 'power',
  biceps: 'power',
  quads: 'foundation',
  hamstrings: 'foundation',
  glutes: 'foundation',
  calves: 'foundation',
  core: 'core',
}

export interface Character {
  profileId: string
  /** Cumulative XP per attribute. Level is derived from XP. */
  xp: Record<Attribute, number>
  totalSessions: number
  /** Best (load, reps) seen per exerciseId, for PR / level-up detection. */
  bests: Record<string, { load: number; reps: number; est1rm: number }>
  streak: number
  lastSessionDate?: number
  updatedAt?: number
}

// --- Objectives (concurrent, real-life training goals) ----------------------
// These layer on top of the base `goal`: they bias gym sessions AND schedule
// off-gym work (mobility flows, runs, loaded walks) with date-aware
// periodization. Objectives live on the Profile so they ride cloud sync.
export type ObjectiveKind = 'posture' | 'run-event' | 'load-carriage'

interface ObjectiveCommon {
  id: string
  kind: ObjectiveKind
  enabled: boolean
  createdAt: number
}

export interface PostureObjective extends ObjectiveCommon {
  kind: 'posture'
  /** Include the short daily desk-reset mobility flow in the plan. */
  dailyReset: boolean
}

export interface RunEventObjective extends ObjectiveCommon {
  kind: 'run-event'
  distanceKm: number
  /** Race day (ms since epoch). */
  targetDate: number
  /** Continuous jogging the trainee can sustain now, minutes (0 = walk only). */
  baselineRunMinutes: number
  /** Preferred number of run days per week. */
  daysPerWeek: number
}

export interface LoadCarriageObjective extends ObjectiveCommon {
  kind: 'load-carriage'
  /** e.g. "Hulaween". */
  eventName: string
  /** Next event day (ms). */
  targetDate: number
  recurringAnnual: boolean
  /** Target pack weight to be comfortable carrying, lb. */
  packLoadLb: number
  /** Consecutive days on your feet at the event. */
  daysOnFeet: number
}

export type Objective = PostureObjective | RunEventObjective | LoadCarriageObjective

// --- Off-gym sessions & weekly planning -------------------------------------
export type SessionType = 'gym' | 'mobility' | 'run' | 'ruck'
export type PlannedKind = SessionType | 'rest'

/** One step of a guided off-gym session (a mobility move, or a run interval). */
export interface GuidedStep {
  label: string
  instruction?: string
  /** Timed hold / interval in seconds — the player auto-advances. */
  seconds?: number
  /** Rep- or count-based move — the player advances on tap. */
  reps?: number
  perSide?: boolean
}

/** A single item on a day's plan. Gym/rest have no steps; the rest are guided. */
export interface PlannedSession {
  kind: PlannedKind
  title: string
  detail: string
  estMinutes: number
  objectiveId?: string
  /** Which character attribute this session mainly develops. */
  attribute?: Attribute
  steps?: GuidedStep[]
}

export interface DayPlan {
  /** 0..6 from the start of the plan (today). */
  offset: number
  weekday: string
  isToday: boolean
  sessions: PlannedSession[]
}

export interface WeekPlan {
  startDate: number
  days: DayPlan[]
}
