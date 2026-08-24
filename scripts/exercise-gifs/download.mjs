import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
const dir = process.argv[2]
const files = readFileSync(dir + '/gif-files.txt', 'utf8').trim().split('\n')
const base = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/master/videos/'
mkdirSync(dir + '/gifs', { recursive: true })
let total = 0, fail = 0
for (const f of files) {
  try {
    const res = await fetch(base + f)
    if (!res.ok) { console.log('FAIL', f, res.status); fail++; continue }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(dir + '/gifs/' + f, buf)
    total += buf.length
  } catch (e) { console.log('ERR', f, e.message); fail++ }
}
console.log(`downloaded ${files.length - fail}/${files.length}, total ${(total / 1024 / 1024).toFixed(1)} MB, avg ${Math.round(total / (files.length - fail) / 1024)} KB, fails ${fail}`)
// sizes histogram
const sizes = files.filter(f => { try { statSync(dir+'/gifs/'+f); return true } catch { return false } }).map(f => statSync(dir+'/gifs/'+f).size).sort((a,b)=>b-a)
console.log('largest 5 (KB):', sizes.slice(0,5).map(s=>Math.round(s/1024)))
