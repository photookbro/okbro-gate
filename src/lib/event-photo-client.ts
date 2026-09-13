/**
 * 브라우저에서 대회 사진을 Vercel body 한도(4.5MB) 아래로 줄입니다.
 * sharp 서버 압축과 비슷한 목표: max width 1920, ~2MB webp/jpeg.
 */

/** multipart 오버헤드를 감안한 안전 상한 (Vercel 서버리스 4.5MB) */
export const EVENT_PHOTO_CLIENT_UPLOAD_MAX_BYTES = 3 * 1024 * 1024

/** 원본 선택 허용 상한 — 이보다 크면 안내 후 거절 (압축 전) */
export const EVENT_PHOTO_CLIENT_PICK_MAX_BYTES = 40 * 1024 * 1024

export const EVENT_PHOTO_CLIENT_MAX_WIDTH = 1920

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])

export function isAllowedEventPhotoMime(type: string): boolean {
  const normalized = type.trim().toLowerCase()
  if (normalized === 'image/jpg') return true
  return ALLOWED.has(normalized)
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('사진을 읽지 못했어요. 다른 파일로 다시 시도해주세요'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality)
  })
}

/**
 * 원본 File → 업로드용 File (webp 우선, 미지원 시 jpeg).
 * 이미 작으면 원본 그대로 반환할 수 있음.
 */
export async function compressEventPhotoForUpload(file: File): Promise<File> {
  if (!isAllowedEventPhotoMime(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('JPEG, PNG, WEBP 이미지만 업로드할 수 있어요')
  }

  if (file.size > EVENT_PHOTO_CLIENT_PICK_MAX_BYTES) {
    throw new Error('사진 파일이 너무 커요. 다른 사진을 선택해주세요')
  }

  // 이미 충분히 작으면 그대로 (서버에서도 재압축)
  if (file.size <= EVENT_PHOTO_CLIENT_UPLOAD_MAX_BYTES) {
    return file
  }

  const img = await loadImageElement(file)
  const scale = Math.min(1, EVENT_PHOTO_CLIENT_MAX_WIDTH / Math.max(img.naturalWidth, 1))
  let width = Math.max(1, Math.round(img.naturalWidth * scale))
  let height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('사진 크기를 줄이는 중 오류가 났어요, 다시 시도해주세요')
  }

  const tryTypes: Array<{ mime: string; ext: string }> = [
    { mime: 'image/webp', ext: 'webp' },
    { mime: 'image/jpeg', ext: 'jpg' },
  ]

  for (const { mime, ext } of tryTypes) {
    let quality = 0.82
    let currentWidth = width
    let currentHeight = height

    for (let attempt = 0; attempt < 16; attempt++) {
      canvas.width = currentWidth
      canvas.height = currentHeight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, currentWidth, currentHeight)
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight)

      const blob = await canvasToBlob(canvas, mime, quality)
      if (!blob) break

      if (blob.size <= EVENT_PHOTO_CLIENT_UPLOAD_MAX_BYTES) {
        const base = file.name.replace(/\.[^.]+$/, '') || 'event-photo'
        return new File([blob], `${base}.${ext}`, { type: mime, lastModified: Date.now() })
      }

      if (quality > 0.45) {
        quality -= 0.08
        continue
      }

      if (currentWidth > 960) {
        currentWidth = Math.max(960, currentWidth - 160)
        currentHeight = Math.max(
          1,
          Math.round((img.naturalHeight / img.naturalWidth) * currentWidth)
        )
        quality = 0.78
        continue
      }

      quality = Math.max(0.35, quality - 0.06)
    }
  }

  throw new Error('사진 크기를 줄이는 중 오류가 났어요, 다시 시도해주세요')
}

export function friendlyEventPhotoUploadError(status: number, serverMessage?: string): string {
  if (status === 413) {
    return '사진 크기를 줄이는 중 오류가 났어요, 다시 시도해주세요'
  }
  if (serverMessage?.trim()) return serverMessage.trim()
  if (status >= 500) {
    return '사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요'
  }
  return '사진 업로드에 실패했어요. 다시 시도해주세요'
}
