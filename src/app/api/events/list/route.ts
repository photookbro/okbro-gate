import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchEventsList, hasEventAlbum } from '@/lib/event-query'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { requireTermsAgreement } from '@/lib/terms-agreement-server'
import { getEventGpsLocations } from '@/lib/gps-locations'
import { MAX_EVENT_LIST_GPS_LOGS } from '@/lib/event-gps-logs'
import { buildPastGpsPassDisplay, emailToUsername } from '@/lib/shoot-record'
import { formatGpsPassDisplay, groupGpsLogsByLocation, type GpsLocationPassGroup } from '@/lib/gps-access'

export async function GET(req: NextRequest) {
  const { past: pastEvents, upcoming: upcomingEvents, error } = await fetchEventsList()

  if (error) {
    console.error('[events/list]', error.message)
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  const gpsLogsByEvent: Record<string, { username: string; time: string }[]> = {}
  const upcomingShootRecordByEvent: Record<string, { username: string; time: string }> = {}
  const upcomingPassGroupsByEvent: Record<string, GpsLocationPassGroup[]> = {}
  const authUser = await getAuthenticatedUser(req)
  let user = authUser
  if (authUser) {
    const termsUser = await requireTermsAgreement(authUser)
    if (termsUser instanceof NextResponse) return termsUser
    user = termsUser
  }

  if (user && pastEvents.length > 0) {
    const admin = supabaseAdmin()
    const eventIds = pastEvents.map(e => e.id)
    const { data: logs } = await admin
      .from('gps_logs')
      .select('event_id, passed_at')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .order('passed_at', { ascending: false })

    const email = user.email ?? '회원'

    for (const log of logs ?? []) {
      if (!log.event_id || !log.passed_at) continue
      const display = buildPastGpsPassDisplay(email, log.passed_at)
      if (!display) continue

      const bucket = gpsLogsByEvent[log.event_id] ?? []
      if (bucket.length >= MAX_EVENT_LIST_GPS_LOGS) continue

      bucket.push(display)
      gpsLogsByEvent[log.event_id] = bucket
    }
  }

  if (user && upcomingEvents.length > 0) {
    const admin = supabaseAdmin()
    const eventIds = upcomingEvents.map(e => e.id)
    const { data: logs } = await admin
      .from('gps_logs')
      .select('event_id, passed_at, pass_count, location_number')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .order('passed_at', { ascending: true })

    const email = user.email ?? '회원'
    const logsByEvent = new Map<
      string,
      { location_number: number | null; pass_count: number | null; passed_at: string | null }[]
    >()

    for (const log of logs ?? []) {
      if (!log.event_id || !log.passed_at) continue
      const bucket = logsByEvent.get(log.event_id) ?? []
      bucket.push({
        location_number: log.location_number,
        pass_count: log.pass_count,
        passed_at: log.passed_at,
      })
      logsByEvent.set(log.event_id, bucket)
    }

    for (const [eventId, eventLogs] of logsByEvent) {
      upcomingPassGroupsByEvent[eventId] = groupGpsLogsByLocation(eventLogs)

      const latestPassedAt = eventLogs.reduce(
        (latest, log) => (log.passed_at && log.passed_at > latest ? log.passed_at : latest),
        ''
      )
      // 실시간 대체 표시라 과거 대회 목록(분 단위)보다 정밀한 초 단위로 표시
      if (latestPassedAt) {
        upcomingShootRecordByEvent[eventId] = {
          username: emailToUsername(email),
          time: formatGpsPassDisplay(latestPassedAt),
        }
      }
    }
  }

  return NextResponse.json({
    past: pastEvents.map(event => {
      const hasAlbum = hasEventAlbum(event)
      return {
        id: event.id,
        name: event.name,
        date: event.date,
        gps_enabled: event.gps_enabled,
        is_pay_event: event.is_pay_event === true,
        has_album: hasAlbum,
        has_any_album: hasAlbum,
        photo_url: event.photo_url ?? null,
        gps_logs: gpsLogsByEvent[event.id] ?? [],
      }
    }),
    upcoming: upcomingEvents.map(event => ({
      id: event.id,
      name: event.name,
      date: event.date,
      gps_enabled: event.gps_enabled,
      is_pay_event: event.is_pay_event === true,
      photo_url: event.photo_url ?? null,
      is_loop_course: false,
      locations: getEventGpsLocations(event).map(location => ({
        location_number: location.locationNumber,
        lat: location.lat,
        lng: location.lng,
        radius_meters: location.radiusMeters,
      })),
      gps_lat: event.gps_1_lat ?? event.gps_lat,
      gps_lng: event.gps_1_lng ?? event.gps_lng,
      gps_radius_meters: event.gps_1_radius_meters ?? event.gps_radius_meters,
      shoot_record: upcomingShootRecordByEvent[event.id] ?? null,
      gps_pass_groups: upcomingPassGroupsByEvent[event.id] ?? [],
    })),
  })
}
