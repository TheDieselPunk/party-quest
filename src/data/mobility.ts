// Mobility-move demo videos (muted, looping) for the guided Desk Reset player.
// Tiny H.264 clips bundled in public/mobility/, keyed by a GuidedStep's `art` id.
// (chin-tuck still uses the original illustrated clip — the true chin-tuck motion
// resisted every generator; its step also carries text cues.)

const MOBILITY_VIDEO: Record<string, string> = {
  'chin-tuck': 'mobility/chin-tuck.mp4',
  'doorway-pec': 'mobility/doorway-pec.mp4',
  'wall-slide': 'mobility/wall-slide.mp4',
  'band-pull-apart': 'mobility/band-pull-apart.mp4',
  'thoracic-extension': 'mobility/thoracic-extension.mp4',
  'hip-flexor': 'mobility/hip-flexor.mp4',
  'glute-bridge': 'mobility/glute-bridge.mp4',
  'cat-cow': 'mobility/cat-cow.mp4',
  // Anterior-pelvic-tilt add-on (posterior tilt = on-style Veo render; dead-bug
  // = the illustrated FitnessProgrammer style, accurate but not the 3D set).
  'posterior-pelvic-tilt': 'mobility/posterior-pelvic-tilt.mp4',
  'dead-bug': 'mobility/dead-bug.mp4',
}

export function mobilityVideo(art?: string): string | undefined {
  if (!art) return undefined
  const p = MOBILITY_VIDEO[art]
  return p ? import.meta.env.BASE_URL + p : undefined
}
