import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'public/icons/admin-icon.svg')
const svg = readFileSync(svgPath)

for (const size of [192, 512]) {
  const outPath = join(root, `public/icons/admin-icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(outPath)
  console.log(`Wrote ${outPath}`)
}
