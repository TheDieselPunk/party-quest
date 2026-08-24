import { readFileSync, writeFileSync } from 'node:fs'
const dir = process.argv[2]
const arr = JSON.parse(readFileSync(dir + '/exercises.json', 'utf8'))
const mapping = JSON.parse(readFileSync(dir + '/mapping.json', 'utf8'))
const norm = (s) => (s || '').toLowerCase()

// Preference token-lists to re-pick better/cleaner matches (shortest name wins).
const REPICK = {
  'machine-chest-press': ['lever chest press'],
  'db-flat-press': ['dumbbell bench press'],
  'incline-db-press': ['dumbbell incline bench press'],
  'machine-shoulder-press': ['lever shoulder press'],
  'db-lateral-raise': ['dumbbell lateral raise'],
  'lat-pulldown': ['cable lat pulldown full', 'cable pulldown pro lat', 'lat pulldown'],
  'seated-row': ['lever seated row', 'leverage seated row', 'seated row'],
  'band-abduction': ['resistance band seated hip abduction', 'band hip abduction'],
  'plank': ['front plank', 'plank'],
  'pushup': ['push-up', 'push up'],
  'kb-swing': ['kettlebell swing'],
  'goblet-squat': ['kettlebell goblet squat', 'goblet squat'],
  'barbell-back-squat': ['barbell full squat', 'barbell front squat', 'barbell squat'],
  'db-overhead-ext': ['dumbbell one arm triceps extension', 'dumbbell triceps extension'],
}
// The dataset has no good match — leave without a GIF (card still shows cues).
const NOGIF = new Set(['face-pull', 'smith-hip-thrust', 'db-hip-thrust', 'band-pull-apart'])

function pick(prefs) {
  for (const p of prefs) {
    const toks = p.split(' ')
    const cands = arr.filter((e) => toks.every((t) => norm(e.name).includes(t)) && e.gif_url)
    if (cands.length) return cands.sort((a, b) => a.name.length - b.name.length)[0]
  }
  return null
}

const final = {}
for (const m of mapping) {
  if (NOGIF.has(m.id)) continue
  let entry = arr.find((e) => e.id === m.ds_id)
  if (REPICK[m.id]) { const p = pick(REPICK[m.id]); if (p) entry = p }
  if (entry && entry.gif_url) {
    final[m.id] = { file: entry.gif_url.replace('videos/', ''), name: entry.name, equipment: entry.equipment }
  }
}

writeFileSync(dir + '/final-mapping.json', JSON.stringify(final, null, 2))
const ids = Object.keys(final)
console.log('exercises with a GIF:', ids.length, '/ 62')
console.log('no GIF:', [...NOGIF].join(', '))
for (const [id, v] of Object.entries(final)) console.log(`  ${id.padEnd(24)} -> ${v.name}`)
// unique gif files to download
const files = [...new Set(Object.values(final).map((v) => v.file))]
console.log('\nunique gif files:', files.length)
writeFileSync(dir + '/gif-files.txt', files.join('\n'))
