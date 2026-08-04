import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  getVerificationInfo,
  isUserExpiringSoon,
  resolveExpiresAt,
  getDaysRemaining,
  type VerificationInfo,
} from '@/lib/order-verification'
import { isInstagramBonusActive, getApprovedInstagramFollowBonus } from '@/lib/instagram-follow-bonus'
import { isGpsTrackingEligible } from '@/lib/gps-tracking-eligibility'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const eventId = new URL(req.url).searchParams.get('event_id')
  const admin = supabaseAdmin()

  const [{ data: order }, settings, instagramBonus] = await Promise.all([
    admin
      .from('orders')
      .select('order_number, used_at, created_at, expires_at')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    loadVerificationSettings(admin),
    getApprovedInstagramFollowBonus(admin, user.id),
  ])

  const verifiedPeriodDays = settings.verifiedPeriodDays

  const purchaseInfo = getVerificationInfo(order ?? null, verifiedPeriodDays)
  const purchaseVerified = purchaseInfo.status === 'valid'
  const instagramActive = isInstagramBonusActive(instagramBonus)
  const gpsTrackingEligible = isGpsTrackingEligible({
    purchaseValid: purchaseVerified,
    instagramActive,
  })
  const expiresAt = order ? resolveExpiresAt(order, verifiedPeriodDays) : null
  const showExpiryWarning =
    purchaseInfo.status === 'valid' &&
    expiresAt != null &&
    isUserExpiringSoon(expiresAt)

  if (eventId) {
    const { data: gpsLog } = await admin
      .from('gps_logs')
      .select('passed_at')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .order('passed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (gpsLog?.passed_at) {
      const gpsAccess: VerificationInfo = {
        status: 'valid',
        access_source: 'gps',
        gps_passed_at: gpsLog.passed_at,
        purchase_verified: purchaseVerified,
        instagram_follow_verified: instagramActive,
        gps_tracking_eligible: gpsTrackingEligible,
      }
      return NextResponse.json({
        ...gpsAccess,
        show_expiry_warning: showExpiryWarning,
      })
    }
  }

  if (instagramActive) {
    const bonusExpiresAt = instagramBonus!.expires_at!
    const instagramAccess: VerificationInfo = {
      status: 'valid',
      access_source: 'instagram_follow',
      purchase_verified: purchaseVerified,
      instagram_follow_verified: true,
      gps_tracking_eligible: gpsTrackingEligible,
      verified_at: instagramBonus!.approved_at ?? undefined,
      expires_at: bonusExpiresAt,
      days_remaining: getDaysRemaining(new Date(bonusExpiresAt)),
    }
    return NextResponse.json({
      ...instagramAccess,
      show_expiry_warning: false,
    })
  }

  if (purchaseInfo.status === 'valid') {
    return NextResponse.json({
      ...purchaseInfo,
      access_source: 'purchase' as const,
      purchase_verified: true,
      instagram_follow_verified: false,
      gps_tracking_eligible: true,
      show_expiry_warning: showExpiryWarning,
    })
  }

  return NextResponse.json({
    ...purchaseInfo,
    purchase_verified: false,
    instagram_follow_verified: false,
    gps_tracking_eligible: false,
    show_expiry_warning: false,
  })
}
