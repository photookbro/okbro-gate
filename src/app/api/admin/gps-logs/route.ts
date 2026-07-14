import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { formatPassTimeSeconds } from '@/lib/geo'

async function buildUserLabelMap(admin: ReturnType<typeof supabaseAdmin>) {
  const labelByUserId = new Map<string, string>()

  const { data: usersRows } = await admin.from('users').select('id, email')
  for (const user of usersRows ?? []) {
    if (user.id) {
      labelByUserId.set(user.id, user.email ?? user.id.slice(0, 8))
    }
  }

  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break

    for (const user of data.users) {
      if (user.id) {
        labelByUserId.set(user.id, user.email ?? user.id.slice(0, 8))
      }
    }

    if (data.users.length < perPage) break
    page++
  }

  return labelByUserId
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const [{ data: event, error: eventError }, { data: logs, error: logsError }] = await Promise.all([
    admin.from('events').select('id, name, date').eq('id', eventId).maybeSingle(),
    admin
      .from('gps_logs')
      .select('id, user_id, passed_at, pass_count, location_number, notified')
      .eq('event_id', eventId)
      .order('location_number', { ascending: true })
      .order('passed_at', { ascending: false }),
  ])

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  if (logsError) {
    console.error('[admin/gps-logs]', logsError)
    return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
  }

  const labelByUserId = await buildUserLabelMap(admin)

  return NextResponse.json({
    event: { id: event.id, name: event.name, date: event.date },
    logs: (logs ?? []).map(log => ({
      id: log.id,
      user_id: log.user_id,
      user_name: log.user_id ? (labelByUserId.get(log.user_id) ?? log.user_id.slice(0, 8)) : '-',
      passed_at: log.passed_at,
      pass_count: log.pass_count ?? 1,
      location_number: log.location_number ?? 1,
      passed_at_display: log.passed_at ? formatPassTimeSeconds(new Date(log.passed_at)) : '-',
      notified: log.notified === true,
    })),
  })
}
