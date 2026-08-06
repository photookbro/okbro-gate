import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const EVENT_FIELDS = [
  'name',
  'date',
  'location',
  'type',
  'photo_count',
  'cover_image_url',
  'drive_folder_id',
  'gps_lat',
  'gps_lng',
  'gps_radius_meters',
  'gps_enabled',
] as const

function pickEventFields(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const key of EVENT_FIELDS) {
    if (key in body) data[key] = body[key]
  }
  return data
}

export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('events')
    .select('*')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const data = pickEventFields(body)

  if (!data.name || !data.date || !data.location || !data.drive_folder_id) {
    return NextResponse.json(
      { error: 'name, date, location, drive_folder_id는 필수입니다.' },
      { status: 400 }
    )
  }

  if (data.gps_radius_meters == null) data.gps_radius_meters = 200
  if (data.gps_enabled == null) data.gps_enabled = false

  const admin = supabaseAdmin()
  const { data: event, error } = await admin
    .from('events')
    .insert(data)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(event, { status: 201 })
}
