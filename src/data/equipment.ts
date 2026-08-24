import type { Equipment } from '../domain/types'

// ---------------------------------------------------------------------------
// David & his wife's actual equipment. This is the heart of the tailoring:
// the engine may ONLY prescribe movements that map to something here, and the
// `modes` tell the player exactly which station/setting to use on each machine.
//
// Increments/min/max are sensible defaults for these Hoist/Matrix units and are
// meant to be user-editable later. Discrete free-weight loads are exact.
// ---------------------------------------------------------------------------

const DUMBBELLS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
const KETTLEBELLS = [15, 35, 45, 70]

export const EQUIPMENT: Equipment[] = [
  // --- Free weights --------------------------------------------------------
  {
    id: 'dumbbell',
    name: 'Dumbbells',
    locations: ['gym'],
    loadType: 'dumbbell',
    isMachine: false,
    fixedLoads: DUMBBELLS,
    notes: 'Pairs from 5 to 50 lb in 5 lb steps.',
  },
  {
    id: 'kettlebell',
    name: 'Kettlebells',
    locations: ['gym', 'studio'],
    loadType: 'kettlebell',
    isMachine: false,
    fixedLoads: KETTLEBELLS,
    notes: 'Pairs at 15, 35, 45, 70 lb.',
  },
  {
    id: 'barbell',
    name: 'Olympic Barbell',
    locations: ['gym'],
    loadType: 'barbell',
    isMachine: false,
    increment: 5, // 2.5 lb plates available → 5 lb per jump
    minLoad: 45,
    maxLoad: 500,
    notes: '45 lb bar. Preferred over the Smith for back squats. "Load" = total including the bar.',
  },
  {
    id: 'ez-bar',
    name: 'EZ Curl Bar',
    locations: ['gym'],
    loadType: 'barbell',
    isMachine: false,
    increment: 5,
    minLoad: 25,
    maxLoad: 150,
    notes: '~25 lb EZ bar for curls and skull-crushers. "Load" = total including the bar.',
  },

  // --- Hoist selectorized / dual-function machines -------------------------
  {
    id: 'hoist-hd3300',
    name: 'Hoist HD-3300 Chest & Shoulder',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // 215 lb stack; David's unit has the 5 lb add-on installed
    minLoad: 10,
    maxLoad: 220,
    modes: [
      {
        id: 'chest-press',
        name: 'Vertical Chest Press',
        setup: 'Seat so handles sit at mid-chest; back flat, drive handles straight forward, control the return.',
      },
      {
        id: 'incline-press',
        name: 'Incline Chest Press',
        setup: 'One-handed angle adjust the press arm to incline; raise the seat so handles start at lower-chest height for upper-chest emphasis.',
      },
      {
        id: 'shoulder-press',
        name: 'Shoulder Press',
        setup: 'Lower the seat so handles start at shoulder height; press overhead without shrugging, stop just short of lockout.',
      },
    ],
  },
  {
    id: 'hoist-hd3200',
    name: 'Hoist HD-3200 Lat Pulldown / Mid Row',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // 225 lb stack; 5 lb add-on installed
    minLoad: 10,
    maxLoad: 230,
    modes: [
      {
        id: 'lat-pulldown',
        name: 'Lat Pulldown',
        setup: 'Thigh pad snug; grab the wide bar, lean back ~15°, pull to the upper chest driving elbows down.',
      },
      {
        id: 'mid-row',
        name: 'Seated Mid Row',
        setup: 'Chest against the pad; row the handles to your waist, squeeze shoulder blades, keep torso still.',
      },
    ],
  },
  {
    id: 'hoist-hd3400',
    name: 'Hoist HD-3400 Leg Curl / Leg Extension',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // 215 lb stack (confirmed HD-3400 spec); 5 lb add-on installed
    minLoad: 10,
    maxLoad: 220,
    modes: [
      {
        id: 'leg-extension',
        name: 'Leg Extension',
        setup: 'Back against the pad, ankle pad on lower shin; extend to nearly straight, pause, lower slowly.',
      },
      {
        id: 'leg-curl',
        name: 'Seated Leg Curl',
        setup: 'Ankle pad on the back of the heels, thigh pad locked; curl down and under, control the return.',
      },
    ],
  },
  {
    id: 'hoist-hd3600',
    name: 'Hoist HD-3600 Ab Crunch / Low Back',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // 180 lb stack; 5 lb add-on installed
    minLoad: 10,
    maxLoad: 185,
    modes: [
      {
        id: 'ab-crunch',
        name: 'Ab Crunch',
        setup: 'Chest pad on upper chest; crunch by shortening the abs (rounding), not by pulling with the arms.',
      },
      {
        id: 'low-back',
        name: 'Low Back Extension',
        setup: 'Back pad against shoulder blades; extend by pushing back through the trunk, stop at a straight line.',
      },
    ],
  },
  {
    id: 'hoist-hd3000',
    name: 'Hoist HD-3000 Dual Adjustable Cable',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // dual 200 lb stacks at 2:1 ratio → ~5 lb effective steps
    minLoad: 5,
    maxLoad: 100, // 2:1 ratio: felt resistance is half the 200 lb stack
    notes: 'Functional trainer, 2:1 ratio (you feel half the stack weight). 32 pulley positions at 2.5". Loads here are effective resistance.',
    modes: [
      {
        id: 'high',
        name: 'High Pulley',
        setup: 'Set both pulleys high (or one side). Used for pushdowns, face pulls, and high-to-low chops.',
      },
      {
        id: 'mid',
        name: 'Mid Pulley',
        setup: 'Set pulleys at chest height. Used for cable rows, chest flyes, and presses.',
      },
      {
        id: 'low',
        name: 'Low Pulley',
        setup: 'Set both pulleys low. Used for curls, lateral/front raises, and low-to-high movements.',
      },
    ],
  },

  // --- Matrix machines -----------------------------------------------------
  {
    id: 'matrix-hipab',
    name: 'Matrix Versa Hip Abductor / Adductor',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5,
    minLoad: 15,
    maxLoad: 250,
    modes: [
      {
        id: 'abduction',
        name: 'Hip Abduction (out)',
        setup: 'Set the pads to the OUTSIDE of the knees; press knees apart, pause at the end, return under control.',
      },
      {
        id: 'adduction',
        name: 'Hip Adduction (in)',
        setup: 'Swap the pads to the INSIDE of the knees (start wide); squeeze knees together, control the opening.',
      },
    ],
  },
  {
    id: 'matrix-legpress',
    name: 'Matrix Versa Leg Press / Calf Press',
    locations: ['gym'],
    loadType: 'stack',
    isMachine: true,
    increment: 5, // Matrix Versa: 5 lb incremental weights
    minLoad: 40,
    maxLoad: 300,
    modes: [
      {
        id: 'leg-press',
        name: 'Leg Press',
        setup: 'Feet mid-platform shoulder-width; lower until knees ~90°, press through mid-foot, don’t lock out hard.',
      },
      {
        id: 'calf-press',
        name: 'Calf Press',
        setup: 'Balls of the feet on the bottom edge of the platform; press through the toes for a full-range calf raise.',
      },
    ],
  },

  // --- Hoist benches / Smith ----------------------------------------------
  {
    id: 'smith',
    name: 'Hoist CF-3755 Angled Smith Machine',
    locations: ['gym'],
    loadType: 'smith',
    isMachine: true,
    increment: 5, // 2.5 lb plates available → 5 lb per jump
    minLoad: 0,
    maxLoad: 540,
    notes: '7° guided bar (25 lb bar) with adjustable safety stops. "Load" = plates added. Per David: NOT for back squats — use the free barbell for those.',
  },
  {
    id: 'bench-adj',
    name: 'Hoist CF-3165 Adjustable Bench',
    locations: ['gym'],
    loadType: 'stack', // acts as an angle host for dumbbell work; not independently loaded
    isMachine: true,
    modes: [
      { id: 'flat', name: 'Flat (0°)', setup: 'Backrest flat for pressing and rows.' },
      { id: 'incline', name: 'Incline (30–45°)', setup: 'Backrest at the 30° or 45° notch for upper-chest and shoulder work (7 positions: -15/0/15/30/45/60/80°).' },
      { id: 'decline', name: 'Decline (-15°)', setup: 'Backrest at the -15° notch for lower-chest emphasis.' },
    ],
    notes: '7 back-pad angles (-15° to 80°) + 5 seat positions. Used with dumbbells; the bench is the station that can be occupied.',
  },
  {
    id: 'ab-bench',
    name: 'Hoist CF-3264 Ab Bench',
    locations: ['gym'],
    loadType: 'bodyweight',
    isMachine: true,
    notes: 'Adjustable ab bench, 7 angles from +10° to -20° (incline & decline). Weighted or bodyweight trunk flexion.',
  },

  // --- Cardio --------------------------------------------------------------
  { id: 'stairmaster', name: 'StairMaster', locations: ['gym'], loadType: 'cardio', isMachine: true },
  { id: 'treadmill', name: 'TRUE Treadmill', locations: ['gym'], loadType: 'cardio', isMachine: true },
  { id: 'elliptical', name: 'TRUE Elliptical', locations: ['gym'], loadType: 'cardio', isMachine: true },
  { id: 'bike', name: 'Stationary Bike', locations: ['gym', 'studio'], loadType: 'cardio', isMachine: true },

  // --- Functional / bodyweight (plentiful, not a single "station") ---------
  { id: 'bodyweight', name: 'Bodyweight', locations: ['gym', 'studio'], loadType: 'bodyweight', isMachine: false },
  { id: 'ab-wheel', name: 'Ab Wheel', locations: ['gym', 'studio'], loadType: 'bodyweight', isMachine: false },
  { id: 'pushup-bars', name: 'Push-up Bars', locations: ['gym'], loadType: 'bodyweight', isMachine: false },
  { id: 'stability-ball', name: 'Stability Ball', locations: ['gym', 'studio'], loadType: 'bodyweight', isMachine: false },
  { id: 'med-ball', name: 'Medicine / Slam Ball', locations: ['gym', 'studio'], loadType: 'bodyweight', isMachine: false },
  { id: 'battle-ropes', name: 'Battle Ropes', locations: ['gym'], loadType: 'bodyweight', isMachine: false },
  { id: 'sandbag', name: 'Weighted Sandbag', locations: ['gym', 'studio'], loadType: 'bodyweight', isMachine: false },
  { id: 'heavy-bag', name: 'Heavy Bag', locations: ['gym'], loadType: 'bodyweight', isMachine: false },
  { id: 'band', name: 'Resistance Bands', locations: ['studio'], loadType: 'band', isMachine: false },
  { id: 'barre', name: 'Ballet Barre', locations: ['studio'], loadType: 'bodyweight', isMachine: false },
]

export const EQUIPMENT_BY_ID: Record<string, Equipment> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
)

export function equipmentForLocation(loc: 'gym' | 'studio'): Equipment[] {
  return EQUIPMENT.filter((e) => e.locations.includes(loc))
}

export function modeOf(equipmentId: string, modeId?: string) {
  if (!modeId) return undefined
  return EQUIPMENT_BY_ID[equipmentId]?.modes?.find((m) => m.id === modeId)
}
