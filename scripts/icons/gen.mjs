import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Rasterize the master SVG into the PNG app icons the manifest / iOS expect.
const here = dirname(fileURLToPath(import.meta.url))
const pub = join(here, '..', '..', 'public')
const svg = readFileSync(join(here, 'icon.svg'))

const outputs = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512], // full-bleed background already maskable-safe
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of outputs) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(pub, name))
  console.log('wrote public/' + name, size + 'x' + size)
}
