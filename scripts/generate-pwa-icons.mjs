import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'public', 'icons', 'icon.svg')
const outDir = path.join(root, 'public', 'icons')

const svg = fs.readFileSync(svgPath)

for (const size of [192, 512]) {
  const outPath = path.join(outDir, `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(outPath)
  console.log(`wrote ${outPath}`)
}
