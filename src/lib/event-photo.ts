import { resolveImageFile } from '@/lib/home-background'

export const EVENT_PHOTO_STORAGE_BUCKET = 'site-assets'
export const EVENT_PHOTO_STORAGE_PATH_PREFIX = 'event-photos'
export const EVENT_PHOTO_MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function eventPhotoStoragePath(eventId: string): string {
  return `${EVENT_PHOTO_STORAGE_PATH_PREFIX}/${eventId}.webp`
}

export function validateEventPhotoFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (!resolveImageFile(file)) {
    return 'JPEG, PNG, WEBP 이미지만 업로드할 수 있어요'
  }
  if (file.size > EVENT_PHOTO_MAX_UPLOAD_BYTES) {
    return '이미지 크기는 20MB 이하여야 해요'
  }
  return null
}
