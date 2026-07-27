import type { SupabaseClient } from '@supabase/supabase-js'

export const VERIFICATION_SETTING_KEYS = [
  'verified_period_days',
  'verified_period_months',
  'instagram_follow_bonus_days',
] as const

export type VerificationSettings = {
  verifiedPeriodDays: number
  instagramFollowBonusDays: number
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

  let instagramFollowBonusDays = Number(settingsMap.instagram_follow_bonus_days)
  if (!Number.isFinite(instagramFollowBonusDays) || instagramFollowBonusDays <= 0) {
    instagramFollowBonusDays = 5
  }

  return {
    verifiedPeriodDays,
    instagramFollowBonusDays,
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
