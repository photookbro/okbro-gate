import type { SupabaseClient } from '@supabase/supabase-js'

export const USER_GPS_TRACKING_PREFS_TABLE = 'user_gps_tracking_prefs'

export async function disableAllUserGpsTrackingPrefsForEvent(
  admin: SupabaseClient,
  eventId: string
): Promise<{ error: Error | null }> {
  const { error } = await admin
    .from(USER_GPS_TRACKING_PREFS_TABLE)
    .update({
      enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)

  return { error: error as Error | null }
}
