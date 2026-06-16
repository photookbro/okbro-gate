import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { formatPassTimeSeconds } from '@/lib/geo'
import { buildPassedAtFromEventDate, isCompleteTime } from '@/lib/time-input'
import { MAX_GPS_PASSES_PER_DAY } from '@/lib/gps-pass'

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

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = await req.json()
  const { event_id, user_id, passed_time, location_number: rawLocationNumber } = body as {
    event_id?: string
    user_id?: string
    passed_time?: string
    location_number?: number
  }

  if (!event_id || !user_id || !passed_time) {
    return NextResponse.json(
      { error: 'event_id, user_id, passed_time이 필요해요' },
      { status: 400 }
    )
  }

  if (!isCompleteTime(passed_time)) {
    return NextResponse.json(
      { error: '통과 시각 형식이 올바르지 않아요 (HH:MM:SS)' },
      { status: 400 }
    )
  }

  const admin = supabaseAdmin()

  const [{ data: event, error: eventError }, { data: authData, error: userError }] =
    await Promise.all([
      admin.from('events').select('id, name, date').eq('id', event_id).maybeSingle(),
      admin.auth.admin.getUserById(user_id),
    ])

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  if (userError || !authData.user) {
    return NextResponse.json({ error: '선수를 찾을 수 없어요' }, { status: 404 })
  }

  const passed_at = buildPassedAtFromEventDate(event.date, passed_time)
  const locationNumber = Number(rawLocationNumber) === 2 ? 2 : 1
  const dayStart = `${event.date}T00:00:00+09:00`
  const dayEnd = new Date(`${event.date}T12:00:00+09:00`)
  dayEnd.setDate(dayEnd.getDate() + 1)
  dayEnd.setHours(0, 0, 0, 0)

  const { data: existingPasses, error: countError } = await admin
    .from('gps_logs')
    .select('id, pass_count')
    .eq('user_id', user_id)
    .eq('event_id', event_id)
    .eq('location_number', locationNumber)
    .gte('passed_at', dayStart)
    .lt('passed_at', dayEnd.toISOString())

  if (countError) {
    console.error('[admin/gps-logs] count failed:', countError)
    return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
  }

  const nextPassCount = (existingPasses?.length ?? 0) + 1
  if (nextPassCount > MAX_GPS_PASSES_PER_DAY) {
    return NextResponse.json(
      { error: `최대 ${MAX_GPS_PASSES_PER_DAY}회까지 기록할 수 있어요` },
      { status: 400 }
    )
  }

  const { data: inserted, error: insertError } = await admin
    .from('gps_logs')
    .insert({
      user_id,
      event_id,
      passed_at,
      location_number: locationNumber,
      pass_count: nextPassCount,
      notified: false,
    })
    .select('id, user_id, passed_at, pass_count, location_number, notified')
    .single()

  if (insertError) {
    console.error('[admin/gps-logs] insert failed:', insertError)
    return NextResponse.json({ error: 'GPS 로그 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    log: {
      id: inserted.id,
      user_id: inserted.user_id,
      passed_at: inserted.passed_at,
      pass_count: inserted.pass_count ?? nextPassCount,
      location_number: inserted.location_number ?? locationNumber,
      passed_at_display: inserted.passed_at
        ? formatPassTimeSeconds(new Date(inserted.passed_at))
        : '-',
      notified: inserted.notified === true,
    },
    event: { id: event.id, name: event.name, date: event.date },
  })
}
