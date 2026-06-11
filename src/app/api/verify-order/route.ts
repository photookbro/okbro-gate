import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  addMonths,
  calculateNewExpiresAt,
} from '@/lib/order-verification'

const NAVER_ORDER_PATTERN = /^\d{4}-\d{8}-\d{8}$/

function parseOrderDate(orderNumber: string | null | undefined): Date | null {
  if (!orderNumber) return null

  const match = orderNumber.match(/^(\d{4})-(\d{8})-(\d{8})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2].slice(0, 2))
  const day = Number(match[2].slice(2, 4))

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function isWithinVerifiedPeriod(orderDate: Date, months: number): boolean {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return orderDate >= cutoff
}

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

  const { data: settings } = await admin
    .from('settings')
    .select('key, value')
    .in('key', ['shared_order_number', 'verified_period_months', 'shared_order_period_months'])

  const settingsMap = Object.fromEntries(
    (settings ?? []).map(({ key, value }) => [key, value])
  )
  const sharedOrderNumber = settingsMap.shared_order_number?.trim()
  const verifiedPeriodMonths = Number(settingsMap.verified_period_months)
  const sharedOrderPeriodMonths = Number(settingsMap.shared_order_period_months ?? 1)

  const isSharedOrder =
    !!sharedOrderNumber &&
    trimmedOrderNumber.toLowerCase() === sharedOrderNumber.toLowerCase()

  const periodMonths = isSharedOrder ? sharedOrderPeriodMonths : verifiedPeriodMonths

  if (!isSharedOrder) {
    if (!NAVER_ORDER_PATTERN.test(trimmedOrderNumber)) {
      return NextResponse.json(
        { error: '네이버 주문번호 형식이 올바르지 않아요 (예: 2024-XXXXXXXX-XXXXXXXX)' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(verifiedPeriodMonths) || verifiedPeriodMonths <= 0) {
      return NextResponse.json({ error: '인증 기간 설정을 확인할 수 없어요' }, { status: 500 })
    }

    const orderDate = parseOrderDate(trimmedOrderNumber)
    if (!orderDate) {
      return NextResponse.json({ error: '주문번호에서 날짜를 확인할 수 없어요' }, { status: 400 })
    }

    if (!isWithinVerifiedPeriod(orderDate, verifiedPeriodMonths)) {
      return NextResponse.json(
        { error: `최근 ${verifiedPeriodMonths}개월 이내 주문만 인증할 수 있어요` },
        { status: 400 }
      )
    }
  }

  const { data: existingOrder } = await admin
    .from('orders')
    .select('id, user_id')
    .eq('order_number', trimmedOrderNumber)
    .maybeSingle()

  if (existingOrder) {
    if (existingOrder.user_id === user.id) {
      return NextResponse.json({ success: true, already_verified: true })
    }

    if (!isSharedOrder) {
      return NextResponse.json(
        { error: '이미 다른 계정에서 사용한 주문번호예요' },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, already_verified: true })
  }

  if (!Number.isFinite(periodMonths) || periodMonths <= 0) {
    return NextResponse.json(
      {
        error: isSharedOrder
          ? '공동 인증번호 유효기간 설정을 확인할 수 없어요'
          : '구매 인증 유효기간 설정을 확인할 수 없어요',
      },
      { status: 500 }
    )
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

  const now = new Date()
  let previousExpires: Date | null = null

  if (userLatestOrder?.expires_at) {
    previousExpires = new Date(userLatestOrder.expires_at)
  } else if (userLatestOrder?.used_at) {
    previousExpires = addMonths(new Date(userLatestOrder.used_at), periodMonths)
  }

  const expiresAt = calculateNewExpiresAt(
    previousExpires && !Number.isNaN(previousExpires.getTime()) ? previousExpires : null,
    periodMonths,
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
