import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

const NAVER_ORDER_PATTERN = /^\d{4}-\d{8}-\d{8}$/

function parseOrderDate(orderNumber: string): Date | null {
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

export async function POST(req: NextRequest) {
  const { order_number, platform } = await req.json()

  if (!order_number?.trim() || !platform) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const trimmedOrderNumber = order_number.trim()
  const admin = supabaseAdmin()

  const { data: settings } = await admin
    .from('settings')
    .select('key, value')
    .in('key', ['shared_order_number', 'verified_period_months'])

  const settingsMap = Object.fromEntries(
    (settings ?? []).map(({ key, value }) => [key, value])
  )
  const sharedOrderNumber = settingsMap.shared_order_number?.trim()
  const verifiedPeriodMonths = Number(settingsMap.verified_period_months)

  const isSharedOrder =
    !!sharedOrderNumber && trimmedOrderNumber === sharedOrderNumber

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

  const { error } = await admin.from('orders').insert({
    user_id: user.id,
    order_number: trimmedOrderNumber,
    platform,
    used_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
