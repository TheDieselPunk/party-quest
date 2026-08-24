import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
const dir = process.argv[2]
const proj = process.argv[3]
const final = JSON.parse(readFileSync(dir + '/final-mapping.json', 'utf8'))
const outDir = proj + '/public/exercise-gifs'
mkdirSync(outDir, { recursive: true })

const map = {}
const attrib = {}
for (const [id, v] of Object.entries(final)) {
  copyFileSync(dir + '/gifs/' + v.file, outDir + '/' + id + '.gif')
  map[id] = `/exercise-gifs/${id}.gif`
  attrib[id] = v.name
}

const header = `// AUTO-GENERATED — exercise demo GIFs mapped to our exercise ids.
// Source: github.com/hasaneyldrm/exercises-dataset (animations bundled locally).
// Regenerate via scripts/install-gifs.mjs. Do not edit by hand.
`
const body = 'export const EXERCISE_GIF: Record<string, string> = ' +
  JSON.stringify(map, null, 2) + '\n\n' +
  'export function gifFor(exerciseId: string): string | undefined {\n' +
  '  const p = EXERCISE_GIF[exerciseId]\n' +
  '  return p ? import.meta.env.BASE_URL + p.replace(/^\\//, \'\') : undefined\n}\n'
writeFileSync(proj + '/src/data/gifs.ts', header + '\n' + body)
console.log('copied', Object.keys(map).length, 'gifs to public/exercise-gifs and wrote src/data/gifs.ts')
