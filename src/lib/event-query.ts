import { supabaseAdmin } from '@/lib/supabase'

export const EVENT_DETAIL_FIELDS =
  'id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters'

export const EVENT_DETAIL_FIELDS_LEGACY =
  'id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_lat, gps_lng, gps_radius_meters'

export const EVENT_LIST_PAST_FIELDS = 'id, name, date, gps_enabled, album_b_url'

export const EVENT_LIST_UPCOMING_FIELDS =
  'id, name, date, gps_enabled, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters, is_loop_course'

export const EVENT_LIST_UPCOMING_FIELDS_LEGACY =
  'id, name, date, gps_enabled, gps_lat, gps_lng, gps_radius_meters, is_loop_course'

export type EventRow = {
  id: string
  name: string
  date: string
  album_a_url?: string | null
  album_b_url?: string | null
  gps_enabled?: boolean | null
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

function isMissingColumnError(message: string | undefined): boolean {
  return !!message && (message.includes('does not exist') || message.includes('42703'))
}

export async function fetchEventById(eventId: string): Promise<{
  data: EventRow | null
  error: Error | null
}> {
  const admin = supabaseAdmin()

  const primary = await admin
    .from('events')
    .select(EVENT_DETAIL_FIELDS)
    .eq('id', eventId)
    .maybeSingle()

  if (!primary.error && primary.data) {
    return { data: primary.data as EventRow, error: null }
  }

  if (primary.error && !isMissingColumnError(primary.error.message)) {
    return { data: null, error: new Error(primary.error.message) }
  }

  const fallback = await admin
    .from('events')
    .select(EVENT_DETAIL_FIELDS_LEGACY)
    .eq('id', eventId)
    .maybeSingle()

  if (fallback.error) {
    return { data: null, error: new Error(fallback.error.message) }
  }

  return { data: (fallback.data as EventRow | null) ?? null, error: null }
}

export async function fetchEventsList(): Promise<{
  past: EventRow[]
  upcoming: EventRow[]
  error: Error | null
}> {
  const admin = supabaseAdmin()
  const cutoff = twelveMonthsAgoDateString()

  const pastResult = await admin
    .from('events')
    .select(EVENT_LIST_PAST_FIELDS)
    .not('album_b_url', 'is', null)
    .neq('album_b_url', '')
    .gte('date', cutoff)
    .order('date', { ascending: false })

  if (pastResult.error) {
    return { past: [], upcoming: [], error: new Error(pastResult.error.message) }
  }

  let upcomingResult = await admin
    .from('events')
    .select(EVENT_LIST_UPCOMING_FIELDS)
    .or('album_b_url.is.null,album_b_url.eq.')
    .order('date', { ascending: true })

  if (upcomingResult.error && isMissingColumnError(upcomingResult.error.message)) {
    upcomingResult = await admin
      .from('events')
      .select(EVENT_LIST_UPCOMING_FIELDS_LEGACY)
      .or('album_b_url.is.null,album_b_url.eq.')
      .order('date', { ascending: true })
  }

  if (upcomingResult.error) {
    return { past: [], upcoming: [], error: new Error(upcomingResult.error.message) }
  }

  return {
    past: (pastResult.data ?? []) as EventRow[],
    upcoming: (upcomingResult.data ?? []) as EventRow[],
    error: null,
  }
}

function twelveMonthsAgoDateString(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
