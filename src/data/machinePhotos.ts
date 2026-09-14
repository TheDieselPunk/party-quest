// Preset photos of the specific gym machines, keyed by equipment id and shown in
// the workout so the real machine is visible (the exercise GIFs are generic and
// don't match how each machine works). Files live in public/equipment/<id>.jpg
// and are bundled/precached like the exercise GIFs. Add an entry below once the
// photo file is in place. Mirrors data/gifs.ts.
//
// Machines (equipment ids) that can have a photo:
//   hoist-hd3300  Hoist HD-3300 Chest & Shoulder
//   hoist-hd3200  Hoist HD-3200 Lat Pulldown / Mid Row
//   hoist-hd3400  Hoist HD-3400 Leg Curl / Leg Extension
//   hoist-hd3600  Hoist HD-3600 Ab Crunch / Low Back
//   hoist-hd3000  Hoist HD-3000 Dual Adjustable Cable
//   matrix-hipab  Matrix Versa Hip Abductor / Adductor
//   matrix-legpress  Matrix Versa Leg Press / Calf Press
//   smith         Hoist CF-3755 Angled Smith Machine
//   bench-adj     Hoist CF-3165 Adjustable Bench
//   ab-bench      Hoist CF-3264 Ab Bench
//   stairmaster   StairMaster
//   treadmill     TRUE Treadmill
//   elliptical    TRUE Elliptical
//   bike          Stationary Bike

const MACHINE_PHOTO: Record<string, string> = {
  'hoist-hd3300': 'equipment/hoist-hd3300.webp',
  'hoist-hd3200': 'equipment/hoist-hd3200.webp',
  'hoist-hd3400': 'equipment/hoist-hd3400.webp',
  'hoist-hd3600': 'equipment/hoist-hd3600.webp',
  'hoist-hd3000': 'equipment/hoist-hd3000.webp',
  'matrix-hipab': 'equipment/matrix-hipab.webp',
  'matrix-legpress': 'equipment/matrix-legpress.webp',
  'smith': 'equipment/smith.webp',
  'bench-adj': 'equipment/bench-adj.webp',
  'ab-bench': 'equipment/ab-bench.webp',
  'stairmaster': 'equipment/stairmaster.webp',
  'treadmill': 'equipment/treadmill.webp',
  'elliptical': 'equipment/elliptical.webp',
  'bike': 'equipment/bike.webp',
}

export function machinePhoto(equipmentId: string): string | undefined {
  const p = MACHINE_PHOTO[equipmentId]
  return p ? import.meta.env.BASE_URL + p : undefined
}
