import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getEventGpsLocations } from '@/lib/gps-locations'
import { buildPastGpsPassDisplay } from '@/lib/shoot-record'

function twelveMonthsAgoDateString(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function hasHighResAlbumUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.trim().length > 0
}

export async function GET() {
  const admin = supabaseAdmin()
  const cutoff = twelveMonthsAgoDateString()

  const [{ data: pastEventsRaw, error: pastError }, upcomingResult] = await Promise.all([
      admin
        .from('events')
        .select('id, name, date, gps_enabled, album_b_url')
        .not('album_b_url', 'is', null)
        .neq('album_b_url', '')
        .gte('date', cutoff)
        .order('date', { ascending: false }),
      admin
        .from('events')
        .select(
          'id, name, date, gps_enabled, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters, is_loop_course'
        )
        .or('album_b_url.is.null,album_b_url.eq.')
        .order('date', { ascending: true }),
    ])
  let upcomingEvents: Record<string, unknown>[] | null = upcomingResult.data
  let upcomingError = upcomingResult.error
  if (upcomingError) {
    const fallback = await admin
      .from('events')
      .select('id, name, date, gps_enabled, gps_lat, gps_lng, gps_radius_meters, is_loop_course')
      .or('album_b_url.is.null,album_b_url.eq.')
      .order('date', { ascending: true })
    upcomingEvents = fallback.data
    upcomingError = fallback.error
  }

  if (pastError || upcomingError) {
    console.error('[events/list]', pastError ?? upcomingError)
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  const pastEvents = (pastEventsRaw ?? []).filter(event => hasHighResAlbumUrl(event.album_b_url))

  const shootRecordByEvent: Record<
    string,
    { username: string; time: string } | null
  > = {}
  const user = await getAuthenticatedUser()

  if (user && pastEvents?.length) {
    const eventIds = pastEvents.map(e => e.id)
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
    past: (pastEvents ?? []).map(event => ({
      id: event.id,
      name: event.name,
      date: event.date,
      gps_enabled: event.gps_enabled,
      shoot_record: shootRecordByEvent[event.id] ?? null,
    })),
    upcoming: (upcomingEvents ?? []).map(event => {
      const row = event as {
        id: string
        name: string
        date: string
        gps_enabled: boolean | null
        is_loop_course?: boolean | null
        gps_1_lat?: number | null
        gps_1_lng?: number | null
        gps_1_radius_meters?: number | null
        gps_2_lat?: number | null
        gps_2_lng?: number | null
        gps_2_radius_meters?: number | null
        gps_lat?: number | null
        gps_lng?: number | null
        gps_radius_meters?: number | null
      }
      return {
        id: row.id,
        name: row.name,
        date: row.date,
        gps_enabled: row.gps_enabled,
        is_loop_course: row.is_loop_course === true,
        locations: getEventGpsLocations(row).map(location => ({
          location_number: location.locationNumber,
          lat: location.lat,
          lng: location.lng,
          radius_meters: location.radiusMeters,
        })),
        gps_lat: row.gps_1_lat ?? row.gps_lat,
        gps_lng: row.gps_1_lng ?? row.gps_lng,
        gps_radius_meters: row.gps_1_radius_meters ?? row.gps_radius_meters,
      }
    }),
  })
}
