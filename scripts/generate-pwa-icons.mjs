import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sourcePath = path.join(root, 'public', 'icons', 'photook-source.png')
const outDir = path.join(root, 'public', 'icons')

if (!fs.existsSync(sourcePath)) {
  console.error(`Source logo not found: ${sourcePath}`)
  process.exit(1)
}

for (const size of [192, 512]) {
  const outPath = path.join(outDir, `icon-${size}.png`)
  await sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: '#FFFFFF' })
    .png()
    .toFile(outPath)
  console.log(`wrote ${outPath}`)
}
