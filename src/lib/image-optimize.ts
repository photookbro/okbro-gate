import 'server-only'

export const IMAGE_OPTIMIZE_MAX_OUTPUT_BYTES = 2 * 1024 * 1024
export const IMAGE_OPTIMIZE_MAX_OUTPUT_WIDTH = 1920

export type OptimizedImage = {
  buffer: Buffer
  mimeType: 'image/webp'
  extension: 'webp'
  width: number
  height: number
  byteSize: number
}

async function loadSharp() {
  try {
    const mod = await import('sharp')
    return mod.default
  } catch (error) {
    console.error('[image-optimize] sharp load failed:', error)
    throw new Error('이미지 처리 모듈(sharp)을 불러오지 못했어요')
  }
}

export async function optimizeImageToWebp(input: Buffer): Promise<OptimizedImage> {
  const sharp = await loadSharp()
  const metadata = await sharp(input, { failOn: 'none' }).rotate().metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('이미지를 읽을 수 없어요')
  }

  let width = Math.min(metadata.width, IMAGE_OPTIMIZE_MAX_OUTPUT_WIDTH)
  let quality = 82

  for (let attempt = 0; attempt < 14; attempt++) {
    const buffer = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toBuffer()

    if (buffer.length <= IMAGE_OPTIMIZE_MAX_OUTPUT_BYTES) {
      const outputMeta = await sharp(buffer).metadata()
      return {
        buffer,
        mimeType: 'image/webp',
        extension: 'webp',
        width: outputMeta.width ?? width,
        height: outputMeta.height ?? metadata.height,
        byteSize: buffer.length,
      }
    }

    if (quality > 48) {
      quality -= 8
      continue
    }

    if (width > 960) {
      width = Math.max(960, width - 160)
      quality = 78
      continue
    }

    quality = Math.max(35, quality - 6)
  }

  throw new Error('이미지를 2MB 이하로 압축하지 못했어요')
}
