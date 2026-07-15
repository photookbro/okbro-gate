import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

// 알파 채널에만 중간값 필터를 적용해서 배경 제거 후 남은 고립된
// 잡티(소금-후추 노이즈)를 정리. RGB는 그대로라 로고 색·형태는 안 바뀜.
// 어떤 생성 스크립트로 만들었든 최종 출력 파일에 이 스크립트를
// 마지막에 돌리면 됨.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = process.argv[2] || path.join(__dirname, '../public/brand/okbro-logo.png')

const { data, info } = await sharp(target).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info
const px = Buffer.from(data)

const cleanedAlpha = await sharp(px, { raw: { width, height, channels } })
  .extractChannel(3)
  .median(3)
  .raw()
  .toBuffer()

for (let i = 0, j = 0; i < px.length; i += channels, j += 1) {
  px[i + 3] = cleanedAlpha[j]
}

await sharp(px, { raw: { width, height, channels } }).png().toFile(target)
const meta = await sharp(target).metadata()
console.log('despeckled', target, meta.width, 'x', meta.height)
