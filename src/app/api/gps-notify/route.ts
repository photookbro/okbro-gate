import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { buildGpsShootNotifyBody } from '@/lib/gps-access'
import { sendPushToUser } from '@/lib/web-push-server'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { event_id } = await req.json()
  if (!event_id) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('id, name')
    .eq('id', event_id)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  const { data: logs, error: logsError } = await admin
    .from('gps_logs')
    .select('id, user_id, passed_at')
    .eq('event_id', event_id)
    .eq('notified', false)
    .order('passed_at', { ascending: true })

  if (logsError) {
    console.error('[gps-notify] fetch logs failed:', logsError)
    return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
  }

  if (!logs?.length) {
    return NextResponse.json({
      success: true,
      event_id,
      event_name: event.name,
      pending: 0,
      notified: 0,
      push_sent: 0,
      push_failed: 0,
      no_subscription: 0,
    })
  }

  let notified = 0
  let pushSent = 0
  let pushFailed = 0
  let noSubscription = 0

  for (const log of logs) {
    const body = buildGpsShootNotifyBody(log.passed_at)
    const { sent, failed } = await sendPushToUser(log.user_id, {
      title: 'OKbroGATE',
      body,
      url: `/events/${event_id}`,
    })

    if (sent > 0) {
      const { error: updateError } = await admin
        .from('gps_logs')
        .update({ notified: true })
        .eq('id', log.id)

      if (!updateError) {
        notified++
        pushSent += sent
      }
    } else if (failed > 0) {
      pushFailed += failed
    } else {
      noSubscription++
    }
  }

  return NextResponse.json({
    success: true,
    event_id,
    event_name: event.name,
    pending: logs.length,
    notified,
    push_sent: pushSent,
    push_failed: pushFailed,
    no_subscription: noSubscription,
  })
}
