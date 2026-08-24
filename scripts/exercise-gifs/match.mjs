import { readFileSync, writeFileSync } from 'node:fs'
const dir = process.argv[2]
const arr = JSON.parse(readFileSync(dir + '/exercises.json', 'utf8'))

console.log('media format sample:', JSON.stringify({ image: arr[0].image, gif_url: arr[0].gif_url, media_id: arr[0].media_id }))

// For each of our curated exercise ids: keywords (must-ish), preferred equipment, target.
const Q = [
  ['machine-chest-press', ['chest press'], ['leverage machine'], 'pectorals'],
  ['db-flat-press', ['dumbbell bench press', 'dumbbell press'], ['dumbbell'], 'pectorals'],
  ['incline-db-press', ['incline dumbbell press'], ['dumbbell'], 'pectorals'],
  ['smith-bench', ['smith machine bench press', 'smith bench'], ['smith machine'], 'pectorals'],
  ['machine-incline-press', ['incline chest press', 'lever incline', 'incline press'], ['leverage machine'], 'pectorals'],
  ['cable-fly', ['cable fly', 'cable crossover'], ['cable'], 'pectorals'],
  ['db-fly', ['dumbbell fly', 'dumbbell flye'], ['dumbbell'], 'pectorals'],
  ['pushup', ['push-up', 'push up'], ['body weight'], 'pectorals'],

  ['lat-pulldown', ['lat pulldown', 'pulldown'], ['cable', 'leverage machine'], 'lats'],
  ['seated-row', ['seated row', 'row'], ['leverage machine', 'cable'], 'upper back'],
  ['cable-row', ['cable row', 'seated cable row'], ['cable'], 'upper back'],
  ['db-row', ['one arm dumbbell row', 'dumbbell row', 'bent over row'], ['dumbbell'], 'upper back'],
  ['smith-row', ['smith machine bent', 'smith row', 'smith machine row'], ['smith machine'], 'upper back'],
  ['cable-straight-arm', ['straight arm pulldown', 'straight-arm'], ['cable'], 'lats'],

  ['machine-shoulder-press', ['shoulder press', 'lever shoulder press'], ['leverage machine'], 'delts'],
  ['db-shoulder-press', ['dumbbell shoulder press', 'seated dumbbell press'], ['dumbbell'], 'delts'],
  ['smith-ohp', ['smith machine overhead', 'smith shoulder press', 'smith machine shoulder'], ['smith machine'], 'delts'],
  ['db-lateral-raise', ['dumbbell lateral raise', 'lateral raise'], ['dumbbell'], 'delts'],
  ['cable-lateral', ['cable lateral raise'], ['cable'], 'delts'],
  ['face-pull', ['face pull'], ['cable'], 'delts'],

  ['db-curl', ['dumbbell biceps curl', 'dumbbell curl'], ['dumbbell'], 'biceps'],
  ['ez-bar-curl', ['ez barbell curl', 'ez bar curl'], ['ez barbell'], 'biceps'],
  ['cable-curl', ['cable curl', 'cable biceps'], ['cable'], 'biceps'],

  ['cable-pushdown', ['triceps pushdown', 'pushdown'], ['cable'], 'triceps'],
  ['db-overhead-ext', ['dumbbell triceps extension', 'overhead'], ['dumbbell'], 'triceps'],
  ['bench-dip', ['bench dip', 'triceps dip'], ['body weight'], 'triceps'],
  ['ez-bar-skullcrusher', ['ez barbell lying', 'lying triceps', 'skull'], ['ez barbell'], 'triceps'],

  ['leg-press', ['leg press'], ['leverage machine', 'sled machine'], 'quads'],
  ['barbell-back-squat', ['barbell full squat', 'barbell squat', 'full squat'], ['barbell', 'olympic barbell'], 'quads'],
  ['goblet-squat', ['goblet squat'], ['kettlebell'], 'quads'],
  ['leg-extension', ['leg extension'], ['leverage machine'], 'quads'],
  ['db-lunge', ['dumbbell lunge', 'reverse lunge'], ['dumbbell'], 'quads'],

  ['leg-curl', ['seated leg curl', 'lying leg curl', 'leg curl'], ['leverage machine'], 'hamstrings'],
  ['smith-rdl', ['smith machine stiff', 'smith machine romanian', 'smith deadlift'], ['smith machine'], 'hamstrings'],
  ['db-rdl', ['dumbbell romanian', 'romanian deadlift', 'stiff leg'], ['dumbbell'], 'hamstrings'],

  ['smith-hip-thrust', ['smith machine hip thrust', 'hip thrust'], ['smith machine'], 'glutes'],
  ['db-hip-thrust', ['dumbbell hip thrust', 'hip thrust'], ['dumbbell', 'barbell'], 'glutes'],
  ['hip-abduction', ['hip abduction', 'abduction'], ['leverage machine'], 'abductors'],
  ['hip-adduction', ['hip adduction', 'adduction'], ['leverage machine'], 'adductors'],

  ['calf-press', ['calf press', 'leg press calf'], ['leverage machine', 'sled machine'], 'calves'],
  ['smith-calf', ['smith machine calf', 'standing calf'], ['smith machine'], 'calves'],

  ['ab-crunch', ['cable crunch', 'machine crunch', 'crunch'], ['cable', 'leverage machine'], 'abs'],
  ['low-back-ext', ['back extension', 'hyperextension'], ['leverage machine', 'body weight'], 'spine'],
  ['ab-wheel', ['wheel rollout', 'ab wheel', 'roller'], ['wheel roller', 'roller'], 'abs'],
  ['plank', ['plank'], ['body weight'], 'abs'],
  ['decline-situp', ['decline sit-up', 'decline situp', 'sit-up'], ['body weight'], 'abs'],
  ['cable-woodchop', ['wood chop', 'cable twist', 'chop'], ['cable'], 'abs'],

  ['stairmaster-intervals', ['stair', 'stepmill'], ['stepmill machine'], 'cardiovascular system'],
  ['treadmill-intervals', ['walk', 'run', 'treadmill'], ['body weight'], 'cardiovascular system'],
  ['bike-intervals', ['bike', 'cycle'], ['stationary bike'], 'cardiovascular system'],
  ['battle-ropes', ['battle rope', 'rope'], ['rope'], 'delts'],
  ['kb-swing', ['kettlebell swing'], ['kettlebell'], 'glutes'],
  ['med-ball-slam', ['medicine ball slam', 'slam', 'overhead throw'], ['medicine ball'], 'abs'],

  ['band-row', ['resistance band seated row', 'band row', 'band seated row'], ['band', 'resistance band'], 'upper back'],
  ['band-pull-apart', ['band pull apart', 'pull apart'], ['band', 'resistance band'], 'delts'],
  ['band-pushdown', ['band triceps pushdown', 'band pushdown'], ['band', 'resistance band'], 'triceps'],
  ['band-curl', ['band curl', 'resistance band curl'], ['band', 'resistance band'], 'biceps'],
  ['band-lateral', ['band lateral raise'], ['band', 'resistance band'], 'delts'],
  ['band-abduction', ['band hip', 'band abduction'], ['band', 'resistance band'], 'abductors'],
  ['sandbag-rdl', ['romanian deadlift', 'stiff leg'], ['barbell', 'dumbbell'], 'hamstrings'],
]

const norm = (s) => (s || '').toLowerCase()
function score(ex, [, kws, equips, target]) {
  const name = norm(ex.name)
  let s = 0
  let kwHit = false
  for (const kw of kws) if (name.includes(kw)) { s += 12 + (20 - kw.length) * 0.1; kwHit = true; break }
  // partial keyword tokens
  if (!kwHit) {
    for (const kw of kws) { const toks = kw.split(' '); const hit = toks.filter((t) => name.includes(t)).length; if (hit) s += hit * 2 }
  }
  if (equips.includes(norm(ex.equipment))) s += 5
  if (norm(ex.target) === target) s += 4
  // prefer entries that actually have a gif
  if (ex.gif_url) s += 1
  return s
}

const out = []
for (const q of Q) {
  let best = null, bestS = -1
  for (const ex of arr) {
    const s = score(ex, q)
    if (s > bestS) { bestS = s; best = ex }
  }
  out.push({ id: q[0], score: +bestS.toFixed(1), match: best.name, equipment: best.equipment, target: best.target, ds_id: best.id, media_id: best.media_id, gif_url: best.gif_url, image: best.image })
}

writeFileSync(dir + '/mapping.json', JSON.stringify(out, null, 2))
for (const r of out) console.log(`${r.score.toString().padStart(5)}  ${r.id.padEnd(24)} -> [${r.equipment}] ${r.match}`)
