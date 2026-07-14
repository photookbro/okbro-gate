import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureHomeBackgroundBucket } from '@/lib/home-background-server'
import { optimizeHomeBackgroundImage } from '@/lib/home-background-optimize'
import {
  EVENT_PHOTO_MAX_UPLOAD_BYTES,
  EVENT_PHOTO_STORAGE_BUCKET,
  eventPhotoStoragePath,
  validateEventPhotoFile,
} from '@/lib/event-photo'

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

  await ensureHomeBackgroundBucket(admin)

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const optimized = await optimizeHomeBackgroundImage(inputBuffer)
  const storagePath = eventPhotoStoragePath(eventId)

  const { error: uploadError } = await admin.storage
    .from(EVENT_PHOTO_STORAGE_BUCKET)
    .upload(storagePath, optimized.buffer, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    })

  if (uploadError) {
    throw uploadError
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
    throw updateError
  }

  return { photoUrl }
}

export async function deleteEventPhoto(admin: SupabaseClient, eventId: string): Promise<void> {
  const storagePath = eventPhotoStoragePath(eventId)

  await admin.storage.from(EVENT_PHOTO_STORAGE_BUCKET).remove([storagePath])

  const { error } = await admin.from('events').update({ photo_url: null }).eq('id', eventId)
  if (error) {
    throw error
  }
}
