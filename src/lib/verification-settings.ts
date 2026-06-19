import type { SupabaseClient } from '@supabase/supabase-js'

export const VERIFICATION_SETTING_KEYS = [
  'shared_order_number',
  'verified_period_days',
  'verified_period_months',
  'shared_order_period_days',
  'shared_order_period_months',
] as const

export type VerificationSettings = {
  sharedOrderNumber: string
  verifiedPeriodDays: number
  sharedOrderPeriodDays: number
}

export function parseVerificationSettings(
  settingsMap: Record<string, string | undefined>
): VerificationSettings {
  const sharedOrderNumber = settingsMap.shared_order_number?.trim() ?? ''

  let verifiedPeriodDays = Number(settingsMap.verified_period_days)
  if (!Number.isFinite(verifiedPeriodDays) || verifiedPeriodDays <= 0) {
    const legacyMonths = Number(settingsMap.verified_period_months)
    verifiedPeriodDays =
      Number.isFinite(legacyMonths) && legacyMonths > 0 ? legacyMonths * 30 : NaN
  }

  let sharedOrderPeriodDays = Number(settingsMap.shared_order_period_days)
  if (!Number.isFinite(sharedOrderPeriodDays) || sharedOrderPeriodDays <= 0) {
    const legacyMonths = Number(settingsMap.shared_order_period_months ?? 1)
    sharedOrderPeriodDays =
      Number.isFinite(legacyMonths) && legacyMonths > 0 ? legacyMonths * 30 : 30
  }

  return {
    sharedOrderNumber,
    verifiedPeriodDays,
    sharedOrderPeriodDays,
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
