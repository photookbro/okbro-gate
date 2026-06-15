import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { event_id } = await req.json()
  if (!event_id) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { start, end } = getTodayRange()

  const { data: existing } = await admin
    .from('gps_logs')
    .select('id, passed_at')
    .eq('user_id', user.id)
    .eq('event_id', event_id)
    .gte('passed_at', start)
    .lt('passed_at', end)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      skipped: true,
      passed_at: existing.passed_at,
    })
  }

  const { data, error } = await admin
    .from('gps_logs')
    .insert({
      user_id: user.id,
      event_id,
      notified: true,
    })
    .select('id, passed_at')
    .single()

  if (error) {
    console.error('[gps-log] insert failed:', error)
    return NextResponse.json({ error: 'GPS 로그 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    skipped: false,
    passed_at: data.passed_at,
  })
}
