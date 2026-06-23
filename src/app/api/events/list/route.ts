import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchEventsList, hasEventAlbum } from '@/lib/event-query'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getEventGpsLocations } from '@/lib/gps-locations'
import { MAX_EVENT_LIST_GPS_LOGS } from '@/lib/event-gps-logs'
import { buildPastGpsPassDisplay } from '@/lib/shoot-record'

export async function GET() {
  const { past: pastEvents, upcoming: upcomingEvents, error } = await fetchEventsList()

  if (error) {
    console.error('[events/list]', error.message)
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  const gpsLogsByEvent: Record<string, { username: string; time: string }[]> = {}
  const user = await getAuthenticatedUser()

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

  return NextResponse.json({
    past: pastEvents.map(event => {
      const hasAlbum = hasEventAlbum(event)
      return {
        id: event.id,
        name: event.name,
        date: event.date,
        gps_enabled: event.gps_enabled,
        has_album: hasAlbum,
        gps_logs: gpsLogsByEvent[event.id] ?? [],
      }
    }),
    upcoming: upcomingEvents.map(event => ({
      id: event.id,
      name: event.name,
      date: event.date,
      gps_enabled: event.gps_enabled,
      is_loop_course: event.is_loop_course === true,
      locations: getEventGpsLocations(event).map(location => ({
        location_number: location.locationNumber,
        lat: location.lat,
        lng: location.lng,
        radius_meters: location.radiusMeters,
      })),
      gps_lat: event.gps_1_lat ?? event.gps_lat,
      gps_lng: event.gps_1_lng ?? event.gps_lng,
      gps_radius_meters: event.gps_1_radius_meters ?? event.gps_radius_meters,
    })),
  })
}
