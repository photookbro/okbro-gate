import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  addDays,
  calculateNewExpiresAt,
} from '@/lib/order-verification'
import { validateNaverOrderNumber } from '@/lib/naver-order-number'
import { ORDER_DUPLICATE_ERROR } from '@/lib/order-duplicate'
import { extendUserOrderVerification } from '@/lib/verify-order-extend'
import { loadVerificationSettings } from '@/lib/verification-settings'

function formatDbError(error: { message?: string; code?: string; details?: string | null }) {
  return {
    message: error.message ?? 'Unknown error',
    code: error.code ?? null,
    details: error.details ?? null,
  }
}

export async function POST(req: NextRequest) {
  const { order_number, platform, event_id } = await req.json()

  if (!order_number?.trim() || !platform) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const trimmedOrderNumber = order_number.trim()
  const admin = supabaseAdmin()
  const settings = await loadVerificationSettings(admin)

  const isHipassOrder =
    !!settings.sharedOrderNumber &&
    trimmedOrderNumber.toLowerCase() === settings.sharedOrderNumber.toLowerCase()

  const periodDays = isHipassOrder
    ? settings.sharedOrderPeriodDays
    : settings.verifiedPeriodDays

  if (!isHipassOrder) {
    const validation = validateNaverOrderNumber(trimmedOrderNumber)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    if (!Number.isFinite(settings.verifiedPeriodDays) || settings.verifiedPeriodDays <= 0) {
      return NextResponse.json({ error: '인증 기간 설정을 확인할 수 없어요' }, { status: 500 })
    }
  }

  const { data: existingOrders } = await admin
    .from('orders')
    .select('id, user_id')
    .eq('order_number', trimmedOrderNumber)

  const ownedBySelf = existingOrders?.find(row => row.user_id === user.id)
  const ownedByOthers = existingOrders?.filter(row => row.user_id !== user.id) ?? []

  if (ownedByOthers.length > 0 && !isHipassOrder) {
    return NextResponse.json(
      { success: false, error: ORDER_DUPLICATE_ERROR },
      { status: 409 }
    )
  }

  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    return NextResponse.json(
      {
        error: isHipassOrder
          ? '하이패스 유효기간 설정을 확인할 수 없어요'
          : '구매 인증 유효기간 설정을 확인할 수 없어요',
      },
      { status: 500 }
    )
  }

  const now = new Date()

  if (ownedBySelf) {
    try {
      const { expiresAt, extended } = await extendUserOrderVerification(
        admin,
        user.id,
        periodDays,
        {
          orderId: ownedBySelf.id,
          eventId: event_id || null,
          now,
        }
      )
      return NextResponse.json({
        success: true,
        extended,
        re_verified: true,
        expires_at: expiresAt.toISOString(),
      })
    } catch (error) {
      const dbError = formatDbError(error as { message?: string; code?: string; details?: string | null })
      console.error('[verify-order] re-verify extend failed:', dbError)
      return NextResponse.json(
        { success: false, error: '인증 연장에 실패했어요', db_error: dbError },
        { status: 500 }
      )
    }
  }

  if (isHipassOrder && ownedByOthers.length > 0) {
    return NextResponse.json({ success: true, already_verified: true })
  }

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
    platform,
    used_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    event_id: event_id || null,
  })

  if (error) {
    const dbError = formatDbError(error)
    console.error('[verify-order] insert failed:', dbError)

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

  return NextResponse.json({
    success: true,
    extended: !!previousExpires,
    expires_at: expiresAt.toISOString(),
  })
}
