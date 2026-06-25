import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { disableAllUserGpsTrackingPrefsForEvent } from '@/lib/user-gps-tracking-prefs-server'

const EVENT_FIELDS =
  'id, name, date, album_a_url, album_b_url, gps_lat, gps_lng, gps_radius_meters, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_enabled, is_loop_course'

const LEGACY_EVENT_FIELDS =
  'id, name, date, album_a_url, album_b_url, gps_lat, gps_lng, gps_radius_meters, gps_enabled'

type EventPayload = {
  name?: string
  date?: string
  album_a_url?: string
  album_b_url?: string
  gps_lat?: number | string | null
  gps_lng?: number | string | null
  gps_radius_meters?: number | string
  gps_1_lat?: number | string | null
  gps_1_lng?: number | string | null
  gps_1_radius_meters?: number | string
  gps_2_lat?: number | string | null
  gps_2_lng?: number | string | null
  gps_2_radius_meters?: number | string
  gps_enabled?: boolean
  is_loop_course?: boolean
}

type EventRow = {
  id: string
  name: string
  date: string
  album_a_url: string | null
  album_b_url: string | null
  gps_lat?: number | null
  gps_lng?: number | null
  gps_radius_meters?: number | null
  gps_1_lat?: number | null
  gps_1_lng?: number | null
  gps_1_radius_meters?: number | null
  gps_2_lat?: number | null
  gps_2_lng?: number | null
  gps_2_radius_meters?: number | null
  gps_enabled: boolean | null
  is_loop_course: boolean | null
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function parseRadius(value: number | string | undefined, fallback = 50): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

function normalizeEventRow(event: EventRow) {
  return {
    ...event,
    is_loop_course: event.is_loop_course ?? false,
    gps_1_lat: event.gps_1_lat ?? event.gps_lat ?? null,
    gps_1_lng: event.gps_1_lng ?? event.gps_lng ?? null,
    gps_1_radius_meters: event.gps_1_radius_meters ?? event.gps_radius_meters ?? 50,
    gps_2_lat: event.gps_2_lat ?? null,
    gps_2_lng: event.gps_2_lng ?? null,
    gps_2_radius_meters: event.gps_2_radius_meters ?? 50,
  }
}

function buildEventRow(body: EventPayload) {
  const gps1Lat = parseOptionalNumber(body.gps_1_lat ?? body.gps_lat)
  const gps1Lng = parseOptionalNumber(body.gps_1_lng ?? body.gps_lng)
  const gps1Radius = parseRadius(body.gps_1_radius_meters ?? body.gps_radius_meters)
  const gps2Lat = parseOptionalNumber(body.gps_2_lat)
  const gps2Lng = parseOptionalNumber(body.gps_2_lng)
  const gps2Radius = parseRadius(body.gps_2_radius_meters)

  return {
    name: body.name?.trim(),
    date: body.date,
    album_a_url: body.album_a_url?.trim() || null,
    album_b_url: body.album_b_url?.trim() || null,
    gps_1_lat: gps1Lat,
    gps_1_lng: gps1Lng,
    gps_1_radius_meters: gps1Radius,
    gps_2_lat: gps2Lat,
    gps_2_lng: gps2Lng,
    gps_2_radius_meters: gps2Radius,
    gps_lat: gps1Lat,
    gps_lng: gps1Lng,
    gps_radius_meters: gps1Radius,
    gps_enabled: !!body.gps_enabled,
    is_loop_course: body.is_loop_course === true,
  }
}

function buildLegacyEventRow(row: ReturnType<typeof buildEventRow>) {
  return {
    name: row.name,
    date: row.date,
    album_a_url: row.album_a_url,
    album_b_url: row.album_b_url,
    gps_lat: row.gps_1_lat,
    gps_lng: row.gps_1_lng,
    gps_radius_meters: row.gps_1_radius_meters,
    gps_enabled: row.gps_enabled,
  }
}

async function fetchEvents() {
  const admin = supabaseAdmin()
  const primary = await admin.from('events').select(EVENT_FIELDS).order('date', { ascending: false })
  if (!primary.error) {
    return (primary.data ?? []).map(event => normalizeEventRow(event as EventRow))
  }

  const fallback = await admin
    .from('events')
    .select(LEGACY_EVENT_FIELDS)
    .order('date', { ascending: false })

  if (fallback.error) {
    return { error: fallback.error as Error }
  }

  return (fallback.data ?? []).map(event => normalizeEventRow(event as EventRow))
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const result = await fetchEvents()
  if (!Array.isArray(result)) {
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ events: result })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = (await req.json()) as EventPayload
  const row = buildEventRow(body)

  if (!row.name || !row.date) {
    return NextResponse.json({ error: '이름과 날짜는 필수예요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('events').insert(row).select(EVENT_FIELDS).single()

  if (error) {
    const legacy = await admin
      .from('events')
      .insert(buildLegacyEventRow(row))
      .select(LEGACY_EVENT_FIELDS)
      .single()
    if (legacy.error) {
      return NextResponse.json({ error: '대회 추가 실패' }, { status: 500 })
    }
    return NextResponse.json({ event: normalizeEventRow(legacy.data as EventRow) })
  }

  return NextResponse.json({ event: normalizeEventRow(data as EventRow) })
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

  const admin = supabaseAdmin()
  const { data, error } = await admin.from('events').update(row).eq('id', id).select(EVENT_FIELDS).single()

  if (error) {
    const legacy = await admin
      .from('events')
      .update(buildLegacyEventRow(row))
      .eq('id', id)
      .select(LEGACY_EVENT_FIELDS)
      .single()
    if (legacy.error) {
      return NextResponse.json({ error: '대회 수정 실패' }, { status: 500 })
    }

    if (!row.gps_enabled) {
      const { error: prefsError } = await disableAllUserGpsTrackingPrefsForEvent(admin, id)
      if (prefsError) {
        console.error('[admin/events] disable user gps prefs', prefsError)
      }
    }

    return NextResponse.json({ event: normalizeEventRow(legacy.data as EventRow) })
  }

  if (!row.gps_enabled) {
    const { error: prefsError } = await disableAllUserGpsTrackingPrefsForEvent(admin, id)
    if (prefsError) {
      console.error('[admin/events] disable user gps prefs', prefsError)
    }
  }

  return NextResponse.json({ event: normalizeEventRow(data as EventRow) })
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
