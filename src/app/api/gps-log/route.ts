import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { haversineDistance } from '@/lib/geo'

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function parseCoordinate(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const body = await req.json()
  const { event_id, lat, lng } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const userLat = parseCoordinate(lat)
  const userLng = parseCoordinate(lng)
  if (userLat === null || userLng === null) {
    return NextResponse.json({ error: 'lat, lng 좌표가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('gps_lat, gps_lng, gps_radius_meters, gps_enabled')
    .eq('id', event_id)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  if (!event.gps_enabled || event.gps_lat == null || event.gps_lng == null) {
    return NextResponse.json({ error: '이 대회는 GPS 감지가 설정되지 않았어요' }, { status: 400 })
  }

  const radiusMeters = event.gps_radius_meters ?? 50
  const distanceMeters = haversineDistance(userLat, userLng, event.gps_lat, event.gps_lng)

  if (distanceMeters > radiusMeters) {
    return NextResponse.json(
      {
        error: '촬영 지점 반경 밖이에요',
        distance_meters: Math.round(distanceMeters),
        radius_meters: radiusMeters,
      },
      { status: 400 }
    )
  }

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
      notified: false,
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
    distance_meters: Math.round(distanceMeters),
    radius_meters: radiusMeters,
  })
}
