import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { optimizeImageToWebp } from '@/lib/image-optimize'
import {
  EVENT_PHOTO_MAX_UPLOAD_BYTES,
  EVENT_PHOTO_STORAGE_BUCKET,
  eventPhotoStoragePath,
  validateEventPhotoFile,
} from '@/lib/event-photo'

const FALLBACK_MAX_BYTES = 2 * 1024 * 1024

async function ensureSiteAssetsBucket(admin: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const bucketExists = (buckets ?? []).some(
    bucket => bucket.id === EVENT_PHOTO_STORAGE_BUCKET || bucket.name === EVENT_PHOTO_STORAGE_BUCKET
  )
  if (bucketExists) return

  const { error: createError } = await admin.storage.createBucket(EVENT_PHOTO_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: FALLBACK_MAX_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw createError
  }
}

function originalUploadPlan(file: File, eventId: string, inputBuffer: Buffer): {
  buffer: Buffer
  contentType: string
  storagePath: string
} {
  if (inputBuffer.length > FALLBACK_MAX_BYTES) {
    throw new Error(
      '이미지 압축에 실패했어요. 2MB 이하 JPEG/PNG로 다시 올려주시거나, 잠시 후 다시 시도해주세요.'
    )
  }

  const mime = (file.type || '').toLowerCase()
  if (mime.includes('png')) {
    return {
      buffer: inputBuffer,
      contentType: 'image/png',
      storagePath: `event-photos/${eventId}.png`,
    }
  }
  if (mime.includes('webp')) {
    return {
      buffer: inputBuffer,
      contentType: 'image/webp',
      storagePath: eventPhotoStoragePath(eventId),
    }
  }
  return {
    buffer: inputBuffer,
    contentType: 'image/jpeg',
    storagePath: `event-photos/${eventId}.jpg`,
  }
}

export async function uploadEventPhoto(
  admin: SupabaseClient,
  eventId: string,
  file: File
): Promise<{ photoUrl: string }> {
  const validationError = validateEventPhotoFile(file)
  if (validationError) {
    throw new Error(validationError)
  }
  if (file.size > EVENT_PHOTO_MAX_UPLOAD_BYTES) {
    throw new Error('이미지 크기는 20MB 이하여야 해요')
  }

  await ensureSiteAssetsBucket(admin)

  const inputBuffer = Buffer.from(await file.arrayBuffer())

  let buffer: Buffer
  let contentType: string
  let storagePath: string

  try {
    const optimized = await optimizeImageToWebp(inputBuffer)
    buffer = optimized.buffer
    contentType = optimized.mimeType
    storagePath = eventPhotoStoragePath(eventId)
  } catch (optimizeError) {
    console.error('[event-photo] optimize failed, uploading original:', optimizeError)
    const plan = originalUploadPlan(file, eventId, inputBuffer)
    buffer = plan.buffer
    contentType = plan.contentType
    storagePath = plan.storagePath
  }

  const { error: uploadError } = await admin.storage
    .from(EVENT_PHOTO_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      upsert: true,
      contentType,
      cacheControl: '3600',
    })

  if (uploadError) {
    throw new Error(uploadError.message || '스토리지 업로드에 실패했어요')
  }

  const { data: publicUrlData } = admin.storage
    .from(EVENT_PHOTO_STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  // 캐시된 이전 이미지가 계속 보이는 것을 막기 위해 매 업로드마다 URL을 갱신
  const photoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await admin
    .from('events')
    .update({ photo_url: photoUrl })
    .eq('id', eventId)

  if (updateError) {
    throw new Error(updateError.message || '대회 사진 URL 저장에 실패했어요')
  }

  return { photoUrl }
}

export async function deleteEventPhoto(admin: SupabaseClient, eventId: string): Promise<void> {
  const paths = [
    eventPhotoStoragePath(eventId),
    `event-photos/${eventId}.jpg`,
    `event-photos/${eventId}.jpeg`,
    `event-photos/${eventId}.png`,
  ]

  await admin.storage.from(EVENT_PHOTO_STORAGE_BUCKET).remove(paths)

  const { error } = await admin.from('events').update({ photo_url: null }).eq('id', eventId)
  if (error) {
    throw new Error(error.message || '대회 사진 삭제에 실패했어요')
  }
}
