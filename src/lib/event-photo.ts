export const EVENT_PHOTO_STORAGE_BUCKET = 'site-assets'
export const EVENT_PHOTO_STORAGE_PATH_PREFIX = 'event-photos'
/** 서버가 받는 업로드 본문 상한 — Vercel 4.5MB 미만 (클라에서 먼저 줄임) */
export const EVENT_PHOTO_MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function eventPhotoStoragePath(eventId: string): string {
  return `${EVENT_PHOTO_STORAGE_PATH_PREFIX}/${eventId}.webp`
}

export function eventPhotoListStoragePath(eventId: string): string {
  return `${EVENT_PHOTO_STORAGE_PATH_PREFIX}/${eventId}-list.webp`
}

/**
 * 원본 photo_url → 목록용 -list.webp URL.
 * 캐시 버스터(?v=)는 유지. 파싱 실패 시 원본 반환.
 */
export function toEventListPhotoUrl(photoUrl: string): string {
  try {
    const url = new URL(photoUrl)
    // already a list thumb
    if (/\/event-photos\/[^/]+-list\.(webp|jpe?g|png)$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(
        /\/event-photos\/([^/]+)-list\.(webp|jpe?g|png)$/i,
        '/event-photos/$1-list.webp'
      )
      return url.toString()
    }
    const next = url.pathname.replace(
      /\/event-photos\/([^/]+)\.(webp|jpe?g|png)$/i,
      '/event-photos/$1-list.webp'
    )
    if (next === url.pathname) return photoUrl
    url.pathname = next
    return url.toString()
  } catch {
    return photoUrl
  }
}

function resolveImageMimeType(file: Pick<File, 'name' | 'type'>): string | null {
  const normalized = file.type.trim().toLowerCase()
  if (normalized === 'image/jpg') return 'image/jpeg'
  if (ALLOWED_IMAGE_TYPES.has(normalized)) return normalized

  const name = file.name.trim().toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'

  return null
}

export function validateEventPhotoFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!resolveImageMimeType(file)) {
    return 'JPEG, PNG, WEBP 이미지만 업로드할 수 있어요'
  }
  if (file.size > EVENT_PHOTO_MAX_UPLOAD_BYTES) {
    return '사진 크기를 줄이는 중 오류가 났어요, 다시 시도해주세요'
  }
  return null
}
