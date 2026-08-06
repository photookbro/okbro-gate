import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  getVerificationInfo,
  isUserExpiringSoon,
  resolveExpiresAt,
  getDaysRemaining,
  type VerificationInfo,
} from '@/lib/order-verification'
import {
  isInstagramBonusActive,
  getApprovedInstagramFollowBonus,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import { isGpsTrackingEligible } from '@/lib/gps-tracking-eligibility'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase-admin'

function logAlbumStatusError(stage: string, error: unknown, extra?: Record<string, unknown>) {
  const err = error as { message?: string; code?: string; details?: string; stack?: string }
  console.error('[verify-order/status] album access failed', {
    stage,
    message: err?.message ?? String(error),
    code: err?.code ?? null,
    details: err?.details ?? null,
    stack: err?.stack ?? (error instanceof Error ? error.stack : null),
    ...extra,
  })
}

export async function GET(req: NextRequest) {
  try {
    return await getAlbumAccessStatus(req)
  } catch (error) {
    logAlbumStatusError('unhandled', error)
    return NextResponse.json(
      { error: '앨범 접근 상태를 불러오지 못했어요' },
      { status: 500 }
    )
  }
}

async function getAlbumAccessStatus(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    // 의도적 클라/인증 오류 — 앨범 페이지는 비로그인으로 취급
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const eventId = new URL(req.url).searchParams.get('event_id')
  const admin = supabaseAdmin()

  const orderResult = await admin
    .from('orders')
    .select('order_number, used_at, created_at, expires_at')
    .eq('user_id', user.id)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (orderResult.error) {
    logAlbumStatusError('orders_query', orderResult.error, { userId: user.id, eventId })
    return NextResponse.json({ error: '주문 인증 조회에 실패했어요' }, { status: 500 })
  }

  let settings
  try {
    settings = await loadVerificationSettings(admin)
  } catch (error) {
    logAlbumStatusError('settings_load', error, { userId: user.id })
    return NextResponse.json({ error: '인증 설정 조회에 실패했어요' }, { status: 500 })
  }

  // 인스타 보너스 테이블/스키마 문제여도 구매·GPS 앨범 접근은 계속 동작
  let instagramBonus: InstagramFollowBonusRow | null = null
  try {
    instagramBonus = await getApprovedInstagramFollowBonus(admin, user.id)
  } catch (error) {
    logAlbumStatusError('instagram_follow_bonus', error, { userId: user.id, eventId })
    instagramBonus = null
  }

  const order = orderResult.data
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
    const { data: gpsLog, error: gpsError } = await admin
      .from('gps_logs')
      .select('passed_at')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .order('passed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (gpsError) {
      logAlbumStatusError('gps_logs_query', gpsError, { userId: user.id, eventId })
      // GPS 조회 실패 시 구매/인스타 경로로 폴백
    } else if (gpsLog?.passed_at) {
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
