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

// 소스가 순백 배경 + 진한 차콜 잉크(고대비)라 임계값을 넉넉히 잡아도
// 실제 로고 색을 침범하지 않음. 245는 너무 빡빡해서 배경의 약한
// 안티에일리어싱/압축 잔여물이 불투명으로 남아 잡티가 됐음 -> 230으로 완화.
const WHITE_THRESHOLD = 230

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info
const px = Buffer.from(data)

for (let i = 0; i < px.length; i += channels) {
  const r = px[i]
  const g = px[i + 1]
  const b = px[i + 2]
  const whiteness = Math.min(r, g, b)
  px[i + 3] = whiteness >= WHITE_THRESHOLD ? 0 : 255
}

// 임계값만으로 못 잡는 고립된 잡티(소금-후추 노이즈)를 알파 채널에만
// 중간값 필터를 적용해서 제거. RGB는 안 건드리니 로고 색·형태는 그대로.
const cleanedAlpha = await sharp(px, { raw: { width, height, channels } })
  .extractChannel(3)
  .median(3)
  .raw()
  .toBuffer()

for (let i = 0, j = 0; i < px.length; i += channels, j += 1) {
  px[i + 3] = cleanedAlpha[j]
}

// 브랜드 팔레트(페라리 레드)에 맞춰 잉크 색을 통일. 알파(형태)는
// 위에서 이미 정리됐으니 불투명 픽셀의 RGB만 바꿈.
const RED = [255, 40, 0]
for (let i = 0; i < px.length; i += channels) {
  if (px[i + 3] > 0) {
    px[i] = RED[0]
    px[i + 1] = RED[1]
    px[i + 2] = RED[2]
  }
}

await sharp(px, { raw: { width, height, channels } }).png().toFile(out)
const meta = await sharp(out).metadata()
console.log('wrote', out, meta.width, 'x', meta.height, 'alpha=', meta.hasAlpha)
