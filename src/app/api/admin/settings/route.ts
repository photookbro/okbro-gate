import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import {
  loadVerificationSettings,
  parseVerificationSettings,
  VERIFICATION_SETTING_KEYS,
} from '@/lib/verification-settings'
import { extendActiveOrdersForPeriodChange } from '@/lib/verification-access'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select('key, value')
    .in('key', [...VERIFICATION_SETTING_KEYS])

  if (error) {
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 })
  }

  const settingsMap = Object.fromEntries((data ?? []).map(({ key, value }) => [key, value]))
  const settings = parseVerificationSettings(settingsMap)

  return NextResponse.json({
    shared_order_number: settings.sharedOrderNumber,
    shared_order_period_days: String(settings.sharedOrderPeriodDays),
    verified_period_days: Number.isFinite(settings.verifiedPeriodDays)
      ? String(settings.verifiedPeriodDays)
      : '',
  })
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { shared_order_number, verified_period_days, shared_order_period_days } = await req.json()

  if (!shared_order_number?.trim()) {
    return NextResponse.json({ error: '하이패스 번호는 필수예요' }, { status: 400 })
  }

  const purchaseDays = Number(verified_period_days)
  if (!Number.isFinite(purchaseDays) || purchaseDays <= 0) {
    return NextResponse.json({ error: '구매 인증 유효기간(일)이 올바르지 않아요' }, { status: 400 })
  }

  const sharedDays = Number(shared_order_period_days)
  if (!Number.isFinite(sharedDays) || sharedDays <= 0) {
    return NextResponse.json({ error: '하이패스 유효기간(일)이 올바르지 않아요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const previousSettings = await loadVerificationSettings(admin)

  const rows = [
    { key: 'shared_order_number', value: shared_order_number.trim() },
    { key: 'verified_period_days', value: String(purchaseDays) },
    { key: 'shared_order_period_days', value: String(sharedDays) },
  ]

  const { error } = await admin.from('settings').upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
  }

  const now = new Date()
  let hipassOrdersExtended = 0
  let purchaseOrdersExtended = 0

  try {
    if (previousSettings.sharedOrderPeriodDays !== sharedDays) {
      hipassOrdersExtended = await extendActiveOrdersForPeriodChange(admin, {
        sharedOrderNumber: shared_order_number.trim(),
        periodDays: sharedDays,
        kind: 'hipass',
        now,
      })
    }

    if (previousSettings.verifiedPeriodDays !== purchaseDays) {
      purchaseOrdersExtended = await extendActiveOrdersForPeriodChange(admin, {
        sharedOrderNumber: shared_order_number.trim(),
        periodDays: purchaseDays,
        kind: 'purchase',
        now,
      })
    }
  } catch (extendError) {
    console.error('[admin/settings] extend active orders failed:', extendError)
    return NextResponse.json({ error: '설정은 저장됐지만 만료일 연장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({
    shared_order_number: shared_order_number.trim(),
    shared_order_period_days: String(sharedDays),
    verified_period_days: String(purchaseDays),
    hipass_orders_extended: hipassOrdersExtended,
    purchase_orders_extended: purchaseOrdersExtended,
  })
}
