import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'

const EVENT_FIELDS =
  'id, name, date, album_a_url, album_b_url, gps_lat, gps_lng, gps_radius_meters, gps_enabled'

type EventPayload = {
  name?: string
  date?: string
  album_a_url?: string
  album_b_url?: string
  gps_lat?: number | string | null
  gps_lng?: number | string | null
  gps_radius_meters?: number | string
  gps_enabled?: boolean
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function buildEventRow(body: EventPayload) {
  const gpsRadius = Number(body.gps_radius_meters)
  const gpsEnabled = !!body.gps_enabled

  return {
    name: body.name?.trim(),
    date: body.date,
    album_a_url: body.album_a_url?.trim() || null,
    album_b_url: body.album_b_url?.trim() || null,
    gps_lat: parseOptionalNumber(body.gps_lat),
    gps_lng: parseOptionalNumber(body.gps_lng),
    gps_radius_meters: Number.isFinite(gpsRadius) && gpsRadius > 0 ? gpsRadius : 50,
    gps_enabled: gpsEnabled,
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { data, error } = await supabaseAdmin()
    .from('events')
    .select(EVENT_FIELDS)
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ events: data })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = (await req.json()) as EventPayload
  const row = buildEventRow(body)

  if (!row.name || !row.date) {
    return NextResponse.json({ error: '이름과 날짜는 필수예요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .insert(row)
    .select(EVENT_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ error: '대회 추가 실패' }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
  }

  const body = (await req.json()) as EventPayload
  const row = buildEventRow(body)

  if (!row.name || !row.date) {
    return NextResponse.json({ error: '이름과 날짜는 필수예요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .update(row)
    .eq('id', id)
    .select(EVENT_FIELDS)
    .single()

  if (error) {
    return NextResponse.json({ error: '대회 수정 실패' }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
  }

  const { error } = await supabaseAdmin().from('events').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: '대회 삭제 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
