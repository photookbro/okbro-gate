import type { SupabaseClient } from '@supabase/supabase-js'

export const VERIFICATION_SETTING_KEYS = [
  'verified_period_days',
  'verified_period_months',
] as const

export type VerificationSettings = {
  verifiedPeriodDays: number
}

export function parseVerificationSettings(
  settingsMap: Record<string, string | undefined>
): VerificationSettings {
  let verifiedPeriodDays = Number(settingsMap.verified_period_days)
  if (!Number.isFinite(verifiedPeriodDays) || verifiedPeriodDays <= 0) {
    const legacyMonths = Number(settingsMap.verified_period_months)
    verifiedPeriodDays =
      Number.isFinite(legacyMonths) && legacyMonths > 0 ? legacyMonths * 30 : NaN
  }

  return {
    verifiedPeriodDays,
  }
}

export async function loadVerificationSettings(
  admin: SupabaseClient
): Promise<VerificationSettings> {
  const { data } = await admin
    .from('settings')
    .select('key, value')
    .in('key', [...VERIFICATION_SETTING_KEYS])

  const settingsMap = Object.fromEntries((data ?? []).map(({ key, value }) => [key, value]))
  return parseVerificationSettings(settingsMap)
}
