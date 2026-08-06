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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const data = pickEventFields(body)

  const admin = supabaseAdmin()
  const { data: event, error } = await admin
    .from('events')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(event)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = supabaseAdmin()
  const { error } = await admin.from('events').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
