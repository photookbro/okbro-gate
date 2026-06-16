import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { haversineDistance } from '@/lib/geo'
import { getEventGpsLocations, parseLocationNumber } from '@/lib/gps-locations'
import {
  getTodayRange,
  MAX_GPS_PASSES_PER_DAY,
} from '@/lib/gps-pass'

function parseCoordinate(value: unknown): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const EVENT_GPS_FIELDS =
  'gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters, gps_enabled, is_loop_course'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const { start, end } = getTodayRange()
  const admin = supabaseAdmin()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select(`id, is_loop_course, ${EVENT_GPS_FIELDS}`)
    .eq('id', eventId)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  const maxPasses = event.is_loop_course === true ? MAX_GPS_PASSES_PER_DAY : 1
  const locations = getEventGpsLocations(event)

  const { data: passes, error } = await admin
    .from('gps_logs')
    .select('id, passed_at, pass_count, location_number')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .gte('passed_at', start)
    .lt('passed_at', end)
    .order('location_number', { ascending: true })
    .order('pass_count', { ascending: true })

  if (error) {
    console.error('[gps-log] list failed:', error)
    return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
  }

  const locationNumbers =
    locations.length > 0 ? locations.map(location => location.locationNumber) : [1]

  const grouped = locationNumbers.map(locationNumber => {
    const locationPasses = (passes ?? []).filter(
      row => (row.location_number ?? 1) === locationNumber
    )
    return {
      location_number: locationNumber,
      pass_count: locationPasses.length,
      max_passes: maxPasses,
      passes: locationPasses,
    }
  })

  return NextResponse.json({
    locations: grouped,
    pass_count: passes?.length ?? 0,
    max_passes: maxPasses,
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const body = await req.json()
  const { event_id, lat, lng, location_number: rawLocationNumber } = body

  if (!event_id) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const userLat = parseCoordinate(lat)
  const userLng = parseCoordinate(lng)
  if (userLat === null || userLng === null) {
    return NextResponse.json({ error: 'lat, lng 좌표가 필요해요' }, { status: 400 })
  }

  const locationNumber = parseLocationNumber(rawLocationNumber)
  const admin = supabaseAdmin()

  const { data: event, error: eventError } = await admin
    .from('events')
    .select(EVENT_GPS_FIELDS)
    .eq('id', event_id)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  if (!event.gps_enabled) {
    return NextResponse.json({ error: '이 대회는 GPS 감지가 설정되지 않았어요' }, { status: 400 })
  }

  const locations = getEventGpsLocations(event)
  const targetLocation = locations.find(location => location.locationNumber === locationNumber)

  if (!targetLocation) {
    return NextResponse.json({ error: '유효하지 않은 촬영 위치예요' }, { status: 400 })
  }

  const distanceMeters = haversineDistance(
    userLat,
    userLng,
    targetLocation.lat,
    targetLocation.lng
  )

  if (distanceMeters > targetLocation.radiusMeters) {
    return NextResponse.json(
      {
        error: '촬영 지점 반경 밖이에요',
        distance_meters: Math.round(distanceMeters),
        radius_meters: targetLocation.radiusMeters,
        location_number: locationNumber,
      },
      { status: 400 }
    )
  }

  const { start, end } = getTodayRange()

  const { data: existingPasses, error: countError } = await admin
    .from('gps_logs')
    .select('id, pass_count')
    .eq('user_id', user.id)
    .eq('event_id', event_id)
    .eq('location_number', locationNumber)
    .gte('passed_at', start)
    .lt('passed_at', end)
    .order('pass_count', { ascending: true })

  if (countError) {
    console.error('[gps-log] count failed:', countError)
    return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
  }

  const maxPasses = event.is_loop_course === true ? MAX_GPS_PASSES_PER_DAY : 1
  const passCountToday = existingPasses?.length ?? 0
  if (passCountToday >= maxPasses) {
    return NextResponse.json(
      {
        error: `오늘 이 위치에서 최대 ${maxPasses}회까지 기록할 수 있어요`,
        pass_count: passCountToday,
        max_passes: maxPasses,
        location_number: locationNumber,
      },
      { status: 400 }
    )
  }

  const nextPassCount = passCountToday + 1

  const { data, error } = await admin
    .from('gps_logs')
    .insert({
      user_id: user.id,
      event_id,
      location_number: locationNumber,
      pass_count: nextPassCount,
      notified: false,
    })
    .select('id, passed_at, pass_count, location_number')
    .single()

  if (error) {
    console.error('[gps-log] insert failed:', error)
    return NextResponse.json({ error: 'GPS 로그 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    passed_at: data.passed_at,
    pass_count: data.pass_count,
    location_number: data.location_number ?? locationNumber,
    passes_today: nextPassCount,
    max_passes: maxPasses,
    distance_meters: Math.round(distanceMeters),
    radius_meters: targetLocation.radiusMeters,
  })
}
