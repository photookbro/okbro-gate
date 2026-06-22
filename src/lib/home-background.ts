export const HOME_BACKGROUND_SETTING_KEY = 'home_background_image_url'
export const HOME_BACKGROUND_POSITION_SETTING_KEY = 'home_background_position'
export const HOME_BACKGROUND_STORAGE_BUCKET = 'site-assets'
export const HOME_BACKGROUND_STORAGE_PATH = 'home-background'

export const DEFAULT_HOME_BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1452626038306-9fff5e01e25f?auto=format&fit=crop&w=1800&q=80'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const HOME_BACKGROUND_MAX_UPLOAD_BYTES = 20 * 1024 * 1024
export const HOME_BACKGROUND_MAX_STORED_BYTES = 2 * 1024 * 1024
export const HOME_BACKGROUND_OUTPUT_MIME_TYPE = 'image/webp'
export const HOME_BACKGROUND_OUTPUT_EXTENSION = 'webp'

export type HomeBackgroundPosition = {
  x: number
  y: number
}

export const DEFAULT_HOME_BACKGROUND_POSITION: HomeBackgroundPosition = { x: 0, y: 0 }

const POSITION_CLAMP = 3000

export function clampHomeBackgroundPosition(position: HomeBackgroundPosition): HomeBackgroundPosition {
  return {
    x: Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, Math.round(position.x))),
    y: Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, Math.round(position.y))),
  }
}

export function parseHomeBackgroundPosition(raw: string | null | undefined): HomeBackgroundPosition {
  if (!raw?.trim()) {
    return { ...DEFAULT_HOME_BACKGROUND_POSITION }
  }

  try {
    const parsed = JSON.parse(raw) as {
      x?: unknown
      y?: unknown
      offset_x?: unknown
      offset_y?: unknown
    }
    const x = Number(parsed.x ?? parsed.offset_x ?? 0)
    const y = Number(parsed.y ?? parsed.offset_y ?? 0)

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ...DEFAULT_HOME_BACKGROUND_POSITION }
    }

    return clampHomeBackgroundPosition({ x, y })
  } catch {
    return { ...DEFAULT_HOME_BACKGROUND_POSITION }
  }
}

export function serializeHomeBackgroundPosition(position: HomeBackgroundPosition): string {
  const clamped = clampHomeBackgroundPosition(position)
  return JSON.stringify(clamped)
}

export function buildHomeBackgroundPositionCSSValue(position: HomeBackgroundPosition): string {
  const { x, y } = clampHomeBackgroundPosition(position)
  if (x === 0 && y === 0) {
    return 'center'
  }
  return `calc(50% + ${x}px) calc(50% + ${y}px)`
}

export type ResolvedImageFile = {
  mimeType: string
  extension: string
}

export function resolveImageMimeType(file: Pick<File, 'name' | 'type'>): string | null {
  const normalized = file.type.trim().toLowerCase()
  if (normalized === 'image/jpg') return 'image/jpeg'
  if (ALLOWED_IMAGE_TYPES.has(normalized)) return normalized

  const name = file.name.trim().toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'

  return null
}

export function resolveImageFile(file: Pick<File, 'name' | 'type'>): ResolvedImageFile | null {
  const mimeType = resolveImageMimeType(file)
  if (!mimeType) return null

  return {
    mimeType,
    extension: extensionForImageMimeType(mimeType),
  }
}

export function resolveHomeBackgroundImageUrl(storedUrl: string | null | undefined): string {
  const trimmed = storedUrl?.trim()
  return trimmed || DEFAULT_HOME_BACKGROUND_IMAGE
}

export function extensionForImageMimeType(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export function validateHomeBackgroundFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!resolveImageMimeType(file)) {
    return 'JPEG, PNG, WEBP 이미지만 업로드할 수 있어요'
  }
  if (file.size > HOME_BACKGROUND_MAX_UPLOAD_BYTES) {
    return '이미지 크기는 20MB 이하여야 해요'
  }
  return null
}

export function formatHomeBackgroundUploadError(error: { message?: string } | null | undefined): string {
  const message = error?.message?.toLowerCase() ?? ''

  if (message.includes('bucket not found')) {
    return 'Storage 버킷(site-assets)이 없어요. Supabase Storage 설정을 확인해주세요.'
  }
  if (message.includes('mime') || message.includes('content type') || message.includes('invalid file type')) {
    return '이미지 형식이 허용되지 않아요. JPEG, PNG, WEBP만 업로드할 수 있어요.'
  }
  if (message.includes('payload too large') || message.includes('file size') || message.includes('too large')) {
    return '이미지 크기는 20MB 이하여야 해요'
  }
  if (message.includes('row-level security') || message.includes('not authorized')) {
    return 'Storage 업로드 권한이 없어요. Supabase Storage 정책을 확인해주세요.'
  }

  return error?.message?.trim() || '이미지 업로드 실패'
}
