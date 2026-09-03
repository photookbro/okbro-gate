import type { SupabaseClient } from '@supabase/supabase-js'
import { getVerificationInfo } from '@/lib/order-verification'
import {
  getEffectiveInstagramFollowBonus,
  isInstagramBonusActive,
} from '@/lib/instagram-follow-bonus'
import { loadVerificationSettings } from '@/lib/verification-settings'

/** GPS 토글 ON 조건: 구매 인증 유효 OR 인스타 팔로우 혜택 유효 (앨범 접근 OR와 별개) */
export function isGpsTrackingEligible(options: {
  purchaseValid: boolean
  instagramActive: boolean
}): boolean {
  return options.purchaseValid || options.instagramActive
}

export async function resolveGpsTrackingEligible(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  eventId?: string | null
): Promise<boolean> {
  if (eventId) {
    const { data: event, error } = await admin
      .from('events')
      .select('is_pay_event')
      .eq('id', eventId)
      .maybeSingle()

    if (!error && event?.is_pay_event === true) return true
  }

  const [{ data: order }, settings, instagramBonus] = await Promise.all([
    admin
      .from('orders')
      .select('order_number, used_at, created_at, expires_at')
      .eq('user_id', userId)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    loadVerificationSettings(admin),
    getEffectiveInstagramFollowBonus(admin, userId),
  ])

  return isGpsTrackingEligible({
    purchaseValid: getVerificationInfo(order ?? null, settings.verifiedPeriodDays).status === 'valid',
    instagramActive: isInstagramBonusActive(instagramBonus, now),
  })
}
