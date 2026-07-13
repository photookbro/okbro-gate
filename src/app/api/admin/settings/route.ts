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
    verified_period_days: Number.isFinite(settings.verifiedPeriodDays)
      ? String(settings.verifiedPeriodDays)
      : '',
  })
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { verified_period_days } = await req.json()

  const purchaseDays = Number(verified_period_days)
  if (!Number.isFinite(purchaseDays) || purchaseDays <= 0) {
    return NextResponse.json({ error: '구매 인증 유효기간(일)이 올바르지 않아요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const previousSettings = await loadVerificationSettings(admin)

  const rows = [{ key: 'verified_period_days', value: String(purchaseDays) }]

  const { error } = await admin.from('settings').upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
  }

  let purchaseOrdersExtended = 0

  try {
    if (previousSettings.verifiedPeriodDays !== purchaseDays) {
      purchaseOrdersExtended = await extendActiveOrdersForPeriodChange(admin, {
        periodDays: purchaseDays,
      })
    }
  } catch (extendError) {
    console.error('[admin/settings] extend active orders failed:', extendError)
    return NextResponse.json({ error: '설정은 저장됐지만 만료일 연장에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({
    verified_period_days: String(purchaseDays),
    purchase_orders_extended: purchaseOrdersExtended,
  })
}
