import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'

const SETTING_KEYS = ['shared_order_number', 'verified_period_months'] as const

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select('key, value')
    .in('key', [...SETTING_KEYS])

  if (error) {
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 })
  }

  const settingsMap = Object.fromEntries((data ?? []).map(({ key, value }) => [key, value]))

  return NextResponse.json({
    shared_order_number: settingsMap.shared_order_number ?? '',
    verified_period_months: settingsMap.verified_period_months ?? '',
  })
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { shared_order_number, verified_period_months } = await req.json()

  if (!shared_order_number?.trim()) {
    return NextResponse.json({ error: '공동 인증번호는 필수예요' }, { status: 400 })
  }

  const months = Number(verified_period_months)
  if (!Number.isFinite(months) || months <= 0) {
    return NextResponse.json({ error: '인증 기간(개월)이 올바르지 않아요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const rows = [
    { key: 'shared_order_number', value: shared_order_number.trim() },
    { key: 'verified_period_months', value: String(months) },
  ]

  const { error } = await admin.from('settings').upsert(rows, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    shared_order_number: shared_order_number.trim(),
    verified_period_months: String(months),
  })
}
