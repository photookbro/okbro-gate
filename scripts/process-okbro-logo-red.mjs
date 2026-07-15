import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src =
  process.argv[2] ||
  'C:/Users/USER/.cursor/projects/c-dev-okbro-gate/assets/c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Ok-40efc7e1-0e9b-4e58-a1c5-665c2bdd41c9.png'
const out = path.join(__dirname, '../public/brand/okbro-logo.png')
const preview = path.join(__dirname, '../public/brand/_preview.png')
const RED = [255, 40, 0]

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info
const srcPx = Buffer.from(data)
const N = width * height

let minX = width
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const lum = 0.2126 * srcPx[i] + 0.7152 * srcPx[i + 1] + 0.0722 * srcPx[i + 2]
    if (lum < 140 && x < minX) minX = x
  }
}

let bestSpan = 0
let bestCy = 0
for (let x = minX; x < minX + 500; x++) {
  let first = -1
  let last = -1
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * channels
    const lum = 0.2126 * srcPx[i] + 0.7152 * srcPx[i + 1] + 0.0722 * srcPx[i + 2]
    if (lum < 140) {
      if (first < 0) first = y
      last = y
    }
  }
  const span = last - first
  if (span > bestSpan) {
    bestSpan = span
    bestCy = (first + last) / 2
  }
}

// Slightly shrink so original soft AA fringe falls outside filled disk
const R = bestSpan / 2 - 1.5
const cy = bestCy
const cx = minX + bestSpan / 2
console.log({ cx, cy, R })

const outPx = Buffer.alloc(N * 4)

// Page-white outside the disk only (so enclosed O cutouts are not eaten)
const bg = new Uint8Array(N)
const q = []
for (let x = 0; x < width; x++) {
  for (const y of [0, height - 1]) {
    const p = y * width + x
    const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5)
    const i = p * channels
    const lum = 0.2126 * srcPx[i] + 0.7152 * srcPx[i + 1] + 0.0722 * srcPx[i + 2]
    if (lum >= 240 && dist > R) {
      bg[p] = 1
      q.push(p)
    }
  }
}
for (let y = 0; y < height; y++) {
  for (const x of [0, width - 1]) {
    const p = y * width + x
    const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5)
    const i = p * channels
    const lum = 0.2126 * srcPx[i] + 0.7152 * srcPx[i + 1] + 0.0722 * srcPx[i + 2]
    if (lum >= 240 && dist > R) {
      bg[p] = 1
      q.push(p)
    }
  }
}
for (let qi = 0; qi < q.length; qi++) {
  const p = q[qi]
  const x = p % width
  const y = (p / width) | 0
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const np = ny * width + nx
    if (bg[np]) continue
    const dist = Math.hypot(nx - cx + 0.5, ny - cy + 0.5)
    if (dist <= R + 0.5) continue
    const i = np * channels
    const lum = 0.2126 * srcPx[i] + 0.7152 * srcPx[i + 1] + 0.0722 * srcPx[i + 2]
    if (lum < 240) continue
    bg[np] = 1
    q.push(np)
  }
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x
    const si = p * channels
    const oi = p * 4
    const r = srcPx[si]
    const g = srcPx[si + 1]
    const b = srcPx[si + 2]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5)

    const soft = 1.0
    let cover = 0
    if (dist <= R - soft / 2) cover = 1
    else if (dist < R + soft / 2) cover = (R + soft / 2 - dist) / soft

    if (cover > 0) {
      outPx[oi] = RED[0]
      outPx[oi + 1] = RED[1]
      outPx[oi + 2] = RED[2]
      outPx[oi + 3] = Math.round(255 * cover)
    }

    const solidWhite = lum >= 250 && chroma <= 8 && !bg[p]
    const solidDark = lum <= 90 && chroma <= 40

    if (dist < R - 1.0 && solidWhite) {
      outPx[oi] = 255
      outPx[oi + 1] = 255
      outPx[oi + 2] = 255
      outPx[oi + 3] = 255
    } else if (dist > R + 1.0 && solidDark) {
      outPx[oi] = 255
      outPx[oi + 1] = 255
      outPx[oi + 2] = 255
      outPx[oi + 3] = 255
    }
  }
}

// Strip white halo only in the rim band (keep O inside & bro outside)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const oi = (y * width + x) * 4
    if (outPx[oi + 3] < 10) continue
    if (!(outPx[oi] > 240 && outPx[oi + 1] > 240 && outPx[oi + 2] > 240)) continue
    const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5)
    if (dist >= R - 2.5 && dist <= R + 3.5) {
      outPx[oi + 3] = 0
    }
  }
}

const png = await sharp(outPx, { raw: { width, height, channels: 4 } }).png().toBuffer()
const trimmed = await sharp(png).trim({ threshold: 3 }).png().toBuffer({ resolveWithObject: true })
await sharp(trimmed.data).png().toFile(out)

const meta = await sharp(out).metadata()
await sharp({
  create: {
    width: meta.width + 120,
    height: meta.height + 120,
    channels: 3,
    background: '#0d0d0d',
  },
})
  .composite([{ input: out, gravity: 'center' }])
  .png()
  .toFile(preview)

console.log('done', meta.width, meta.height)
