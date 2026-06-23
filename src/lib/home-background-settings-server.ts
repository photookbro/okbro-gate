import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HOME_BACKGROUND_POSITION_SETTING_KEY,
  HOME_BACKGROUND_SETTING_KEY,
  clampHomeBackgroundPosition,
  parseHomeBackgroundPosition,
  serializeHomeBackgroundPosition,
  type HomeBackgroundPosition,
} from '@/lib/home-background'

function normalizeSettingValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value == null) return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim() || null
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

  return normalizeSettingValue(data?.value)
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

  return parseHomeBackgroundPosition(normalizeSettingValue(data?.value))
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
    imageUrl: normalizeSettingValue(rows[HOME_BACKGROUND_SETTING_KEY]),
    position: parseHomeBackgroundPosition(normalizeSettingValue(rows[HOME_BACKGROUND_POSITION_SETTING_KEY])),
  }
}
