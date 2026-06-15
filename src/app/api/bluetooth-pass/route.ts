import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { sendPushToUser } from '@/lib/web-push-server'

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

  const { event_id, user_id } = await req.json()
  if (!event_id) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  if (user_id && user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
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

  const { data: event } = await admin.from('events').select('name').eq('id', event_id).maybeSingle()
  const eventName = event?.name ?? '대회'

  const { data, error } = await admin
    .from('gps_logs')
    .insert({
      user_id: user.id,
      event_id,
      notified: false,
    })
    .select('id, passed_at')
    .single()

  if (error) {
    console.error('[bluetooth-pass] insert failed:', error)
    return NextResponse.json({ error: '통과 기록 저장 실패' }, { status: 500 })
  }

  const passedAt = new Date(data.passed_at)
  const timeLabel = passedAt.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const pushBody = `✅ ${eventName} 촬영자 통과! ${timeLabel}`

  const { sent } = await sendPushToUser(user.id, {
    title: '오켱사진링크게이트',
    body: pushBody,
    url: '/mypage',
  })

  if (sent > 0) {
    await admin.from('gps_logs').update({ notified: true }).eq('id', data.id)
  }

  return NextResponse.json({
    success: true,
    skipped: false,
    passed_at: data.passed_at,
    message: pushBody,
    push_sent: sent > 0,
  })
}
