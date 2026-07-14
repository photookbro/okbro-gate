import { supabaseAdmin } from '@/lib/supabase'
import {
  classifyEventsForList,
  hasEventAlbum,
  twelveMonthsAgoDateString,
} from '@/lib/events-list-classify'

export { hasEventAlbum } from '@/lib/events-list-classify'

export const EVENT_DETAIL_FIELDS =
  'id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters'

export const EVENT_DETAIL_FIELDS_LEGACY =
  'id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_lat, gps_lng, gps_radius_meters'

export const EVENT_LIST_PAST_FIELDS = 'id, name, date, gps_enabled, album_b_url, photo_url'

export const EVENT_LIST_FIELDS =
  'id, name, date, gps_enabled, album_b_url, photo_url, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters, is_loop_course'

export const EVENT_LIST_FIELDS_LEGACY =
  'id, name, date, gps_enabled, album_b_url, gps_lat, gps_lng, gps_radius_meters, is_loop_course'

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
  photo_url?: string | null
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

  const primary = await admin
    .from('events')
    .select(EVENT_LIST_FIELDS)
    .gte('date', cutoff)
    .order('date', { ascending: false })

  let rows: EventRow[]

  if (!primary.error) {
    rows = (primary.data ?? []) as EventRow[]
  } else if (isMissingColumnError(primary.error.message)) {
    const fallback = await admin
      .from('events')
      .select(EVENT_LIST_FIELDS_LEGACY)
      .gte('date', cutoff)
      .order('date', { ascending: false })

    if (fallback.error) {
      return { past: [], upcoming: [], error: new Error(fallback.error.message) }
    }
    rows = (fallback.data ?? []) as EventRow[]
  } else {
    return { past: [], upcoming: [], error: new Error(primary.error.message) }
  }

  const classified = classifyEventsForList(rows, { cutoff })

  return {
    past: classified.past as EventRow[],
    upcoming: classified.upcoming as EventRow[],
    error: null,
  }
}
