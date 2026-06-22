import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { optimizeHomeBackgroundImage } from '@/lib/home-background-optimize'
import {
  DEFAULT_HOME_BACKGROUND_POSITION,
  HOME_BACKGROUND_MAX_STORED_BYTES,
  HOME_BACKGROUND_MAX_UPLOAD_BYTES,
  HOME_BACKGROUND_OUTPUT_EXTENSION,
  HOME_BACKGROUND_OUTPUT_MIME_TYPE,
  HOME_BACKGROUND_POSITION_SETTING_KEY,
  HOME_BACKGROUND_SETTING_KEY,
  HOME_BACKGROUND_STORAGE_BUCKET,
  HOME_BACKGROUND_STORAGE_PATH,
  clampHomeBackgroundPosition,
  parseHomeBackgroundPosition,
  resolveImageFile,
  serializeHomeBackgroundPosition,
  type HomeBackgroundPosition,
} from '@/lib/home-background'

export async function ensureHomeBackgroundBucket(admin: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const bucketExists = (buckets ?? []).some(
    bucket => bucket.id === HOME_BACKGROUND_STORAGE_BUCKET || bucket.name === HOME_BACKGROUND_STORAGE_BUCKET
  )
  if (bucketExists) return

  const { error: createError } = await admin.storage.createBucket(HOME_BACKGROUND_STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: HOME_BACKGROUND_MAX_STORED_BYTES,
    allowedMimeTypes: ['image/webp'],
  })

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw createError
  }
}

export async function uploadHomeBackgroundImage(admin: SupabaseClient, file: File): Promise<{
  imageUrl: string
  storedBytes: number
  outputWidth: number
  outputHeight: number
}> {
  const resolved = resolveImageFile(file)
  if (!resolved) {
    throw new Error('JPEG, PNG, WEBP 이미지만 업로드할 수 있어요')
  }

  if (file.size > HOME_BACKGROUND_MAX_UPLOAD_BYTES) {
    throw new Error('이미지 크기는 20MB 이하여야 해요')
  }

  await ensureHomeBackgroundBucket(admin)

  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const optimized = await optimizeHomeBackgroundImage(inputBuffer)
  const storagePath = `${HOME_BACKGROUND_STORAGE_PATH}.${HOME_BACKGROUND_OUTPUT_EXTENSION}`

  const { error: uploadError } = await admin.storage
    .from(HOME_BACKGROUND_STORAGE_BUCKET)
    .upload(storagePath, optimized.buffer, {
      upsert: true,
      contentType: HOME_BACKGROUND_OUTPUT_MIME_TYPE,
      cacheControl: '3600',
    })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicUrlData } = admin.storage
    .from(HOME_BACKGROUND_STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  return {
    imageUrl: publicUrlData.publicUrl,
    storedBytes: optimized.byteSize,
    outputWidth: optimized.width,
    outputHeight: optimized.height,
  }
}

export async function loadHomeBackgroundImageUrl(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', HOME_BACKGROUND_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  const value = data?.value?.trim()
  return value || null
}

export async function saveHomeBackgroundImageUrl(
  admin: SupabaseClient,
  imageUrl: string
): Promise<void> {
  const { error } = await admin.from('settings').upsert(
    { key: HOME_BACKGROUND_SETTING_KEY, value: imageUrl },
    { onConflict: 'key' }
  )

  if (error) {
    throw error
  }
}

export async function loadHomeBackgroundPosition(admin: SupabaseClient): Promise<HomeBackgroundPosition> {
  const { data, error } = await admin
    .from('settings')
    .select('value')
    .eq('key', HOME_BACKGROUND_POSITION_SETTING_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return parseHomeBackgroundPosition(data?.value)
}

export async function saveHomeBackgroundPosition(
  admin: SupabaseClient,
  position: HomeBackgroundPosition
): Promise<HomeBackgroundPosition> {
  const clamped = clampHomeBackgroundPosition(position)
  const { error } = await admin.from('settings').upsert(
    {
      key: HOME_BACKGROUND_POSITION_SETTING_KEY,
      value: serializeHomeBackgroundPosition(clamped),
    },
    { onConflict: 'key' }
  )

  if (error) {
    throw error
  }

  return clamped
}

export async function loadHomeBackgroundSettings(admin: SupabaseClient): Promise<{
  imageUrl: string | null
  position: HomeBackgroundPosition
}> {
  const { data, error } = await admin
    .from('settings')
    .select('key, value')
    .in('key', [HOME_BACKGROUND_SETTING_KEY, HOME_BACKGROUND_POSITION_SETTING_KEY])

  if (error) {
    throw error
  }

  const rows = Object.fromEntries((data ?? []).map(row => [row.key, row.value]))

  return {
    imageUrl: rows[HOME_BACKGROUND_SETTING_KEY]?.trim() || null,
    position: parseHomeBackgroundPosition(rows[HOME_BACKGROUND_POSITION_SETTING_KEY]),
  }
}
