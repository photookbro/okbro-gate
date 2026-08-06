import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  addDays,
  calculateNewExpiresAt,
} from '@/lib/order-verification'
import { validateNaverOrderNumber } from '@/lib/naver-order-number'
import {
  ORDER_DUPLICATE_ERROR,
  logDuplicateVerificationAttempt,
} from '@/lib/order-duplicate'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { sendKakaoNotify } from '@/lib/kakao-notify'
import { checkRateLimit, clientIpFromRequest } from '@/lib/rate-limit'

function formatDbError(error: { message?: string; code?: string; details?: string | null }) {
  return {
    message: error.message ?? 'Unknown error',
    code: error.code ?? null,
    details: error.details ?? null,
  }
}

async function notifyVerifySuccess(
  admin: ReturnType<typeof supabaseAdmin>,
  userEmail: string | undefined,
  eventId: string | null,
  orderNumber: string
) {
  let eventName = '전체 이용권'
  if (eventId) {
    const { data: event } = await admin.from('events').select('name').eq('id', eventId).maybeSingle()
    eventName = event?.name ?? '전체 이용권'
  }
  const last4 = orderNumber.slice(-4)
  await sendKakaoNotify(`[오켱GATE] 인증 성공: ${eventName} - ${userEmail ?? '알 수 없음'} - 주문번호 ****${last4}`)
}

function duplicateResponse() {
  return NextResponse.json({ success: false, error: ORDER_DUPLICATE_ERROR }, { status: 409 })
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req.headers)
  const rl = checkRateLimit(`verify-order:${ip}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      }
    )
  }

  const { order_number, platform, event_id } = await req.json()

  if (!order_number?.trim() || !platform) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const trimmedOrderNumber = order_number.trim()
  const platformValue = String(platform).trim() || 'naver'
  const admin = supabaseAdmin()
  const settings = await loadVerificationSettings(admin)
  const periodDays = settings.verifiedPeriodDays

  const validation = validateNaverOrderNumber(trimmedOrderNumber)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { data: existingOrders } = await admin
    .from('orders')
    .select('id, user_id')
    .eq('order_number', trimmedOrderNumber)
    .eq('platform', platformValue)

  // 하드락: (platform, order_number) 존재 시 본인/타인 모두 거부
  // 만기 연장은 아직 쓰이지 않은 새 주문번호 insert로만 가능
  const existing = existingOrders?.[0]
  if (existing) {
    after(() =>
      logDuplicateVerificationAttempt(admin, {
        userId: user.id,
        userEmail: user.email,
        orderNumber: trimmedOrderNumber,
        platform: platformValue,
        existingOrderId: existing.id,
        existingUserId: existing.user_id,
      })
    )
    return duplicateResponse()
  }

  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    return NextResponse.json(
      { error: '구매 인증 유효기간 설정을 확인할 수 없어요' },
      { status: 500 }
    )
  }

  const now = new Date()

  const { data: userLatestOrder, error: latestOrderError } = await admin
    .from('orders')
    .select('expires_at, used_at')
    .eq('user_id', user.id)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestOrderError && latestOrderError.code === 'PGRST204') {
    const dbError = formatDbError(latestOrderError)
    console.error('[verify-order] orders schema missing columns:', dbError)
    return NextResponse.json(
      {
        error:
          'orders 테이블에 expires_at 컬럼이 없어요. Supabase SQL Editor에서 마이그레이션 SQL을 실행해주세요.',
        db_error: dbError,
      },
      { status: 500 }
    )
  }

  let previousExpires: Date | null = null

  if (userLatestOrder?.expires_at) {
    previousExpires = new Date(userLatestOrder.expires_at)
  } else if (userLatestOrder?.used_at) {
    previousExpires = addDays(new Date(userLatestOrder.used_at), periodDays)
  }

  const expiresAt = calculateNewExpiresAt(
    previousExpires && !Number.isNaN(previousExpires.getTime()) ? previousExpires : null,
    periodDays,
    now
  )

  const { error } = await admin.from('orders').insert({
    user_id: user.id,
    order_number: trimmedOrderNumber,
    platform: platformValue,
    used_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    event_id: event_id || null,
  })

  if (error) {
    const dbError = formatDbError(error)
    console.error('[verify-order] insert failed:', dbError)

    // 레이스로 UNIQUE 충돌 → 하드락과 동일하게 거절
    if (error.code === '23505') {
      after(() =>
        logDuplicateVerificationAttempt(admin, {
          userId: user.id,
          userEmail: user.email,
          orderNumber: trimmedOrderNumber,
          platform: platformValue,
        })
      )
      return duplicateResponse()
    }

    if (error.code === 'PGRST204') {
      return NextResponse.json(
        {
          error:
            'orders 테이블 스키마가 맞지 않아요. expires_at / event_id 컬럼 마이그레이션이 필요합니다.',
          db_error: dbError,
        },
        { status: 500 }
      )
    }

    if (error.code === '23503') {
      return NextResponse.json(
        {
          error: '유저 정보가 DB에 없어요. users 테이블과 auth.users 연동을 확인해주세요.',
          db_error: dbError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: '저장 실패', db_error: dbError },
      { status: 500 }
    )
  }

  after(() => notifyVerifySuccess(admin, user.email, event_id || null, trimmedOrderNumber))

  return NextResponse.json({
    success: true,
    extended: !!previousExpires,
    expires_at: expiresAt.toISOString(),
  })
}
