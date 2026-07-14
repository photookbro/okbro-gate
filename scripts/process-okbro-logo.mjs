import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src =
  'C:/Users/USER/.cursor/projects/c-dev-okbro-gate/assets/c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Ok-bfa7f527-32b7-4de0-a23a-8d89409ee893.png'
const outDir = path.join(root, 'public', 'brand')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'okbro-logo.png')

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info
const px = Buffer.from(data)

for (let i = 0; i < px.length; i += channels) {
  const r = px[i]
  const g = px[i + 1]
  const b = px[i + 2]
  // Near-white page background -> transparent
  if (r >= 245 && g >= 245 && b >= 245) {
    px[i + 3] = 0
  }
}

await sharp(px, { raw: { width, height, channels } }).png().toFile(out)
const meta = await sharp(out).metadata()
console.log('wrote', out, meta.width, 'x', meta.height, 'alpha=', meta.hasAlpha)
