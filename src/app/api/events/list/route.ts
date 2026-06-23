import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchEventsList, hasEventAlbum } from '@/lib/event-query'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getEventGpsLocations } from '@/lib/gps-locations'
import { buildPastGpsPassDisplay } from '@/lib/shoot-record'

export async function GET() {
  const { past: pastEvents, upcoming: upcomingEvents, error } = await fetchEventsList()

  if (error) {
    console.error('[events/list]', error.message)
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  const pastWithAlbum = pastEvents.filter(event => hasEventAlbum(event))

  const shootRecordByEvent: Record<
    string,
    { username: string; time: string } | null
  > = {}
  const user = await getAuthenticatedUser()

  if (user && pastWithAlbum.length) {
    const admin = supabaseAdmin()
    const eventIds = pastWithAlbum.map(e => e.id)
    const { data: logs } = await admin
      .from('gps_logs')
      .select('event_id, passed_at')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .order('passed_at', { ascending: false })

    const email = user.email ?? '회원'

    for (const log of logs ?? []) {
      if (!log.event_id || !log.passed_at || shootRecordByEvent[log.event_id]) continue
      const record = buildPastGpsPassDisplay(email, log.passed_at)
      if (record) {
        shootRecordByEvent[log.event_id] = record
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
        has_album: hasAlbum,
        shoot_record: hasAlbum ? (shootRecordByEvent[event.id] ?? null) : null,
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
