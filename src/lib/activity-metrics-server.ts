import type { SupabaseClient } from '@supabase/supabase-js'
import {
  startOfKstDay,
  startOfKstWeek,
  startOfPreviousKstWeek,
} from '@/lib/kst-date'

function inRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false
  const ms = new Date(iso).getTime()
  return ms >= start.getTime() && ms < end.getTime()
}

/** Users with last_active_at on today's KST calendar day. */
export async function countDau(admin: SupabaseClient): Promise<number | null> {
  const start = startOfKstDay()
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const { count, error } = await admin
    .from('profiles')
    .select('user_id', { count: 'exact', head: true })
    .gte('last_active_at', start.toISOString())
    .lt('last_active_at', end.toISOString())

  if (error) {
    if (error.code === '42703' || error.message?.includes('last_active_at')) {
      return null
    }
    throw error
  }

  return count ?? 0
}

async function collectActiveUserIdsInRange(
  admin: SupabaseClient,
  start: Date,
  end: Date
): Promise<Set<string>> {
  const active = new Set<string>()

  const [
    { data: profiles, error: profilesError },
    { data: gpsLogs },
    { data: orders },
    { data: terms },
    { data: prefs },
  ] = await Promise.all([
    admin.from('profiles').select('user_id, last_active_at'),
    admin.from('gps_logs').select('user_id, passed_at'),
    admin.from('orders').select('user_id, used_at, created_at'),
    admin.from('terms_agreements').select('user_id, agreed_at'),
    admin.from('user_gps_tracking_prefs').select('user_id, updated_at'),
  ])

  if (profilesError && !profilesError.message?.includes('last_active_at')) {
    throw profilesError
  }

  for (const row of profiles ?? []) {
    if (row.user_id && inRange(row.last_active_at, start, end)) {
      active.add(row.user_id)
    }
  }

  for (const row of gpsLogs ?? []) {
    if (row.user_id && inRange(row.passed_at, start, end)) {
      active.add(row.user_id)
    }
  }

  for (const row of orders ?? []) {
    if (!row.user_id) continue
    if (inRange(row.used_at, start, end) || inRange(row.created_at, start, end)) {
      active.add(row.user_id)
    }
  }

  for (const row of terms ?? []) {
    if (row.user_id && inRange(row.agreed_at, start, end)) {
      active.add(row.user_id)
    }
  }

  for (const row of prefs ?? []) {
    if (row.user_id && inRange(row.updated_at, start, end)) {
      active.add(row.user_id)
    }
  }

  return active
}

export type ReturnVisitRate = {
  rate_percent: number | null
  this_week_active: number
  returning_users: number
  note: string
}

/**
 * Share of this-week active users who were also active last week.
 * Uses composite activity signals (GPS, orders, terms, prefs, last_active_at).
 */
export async function computeReturnVisitRate(
  admin: SupabaseClient
): Promise<ReturnVisitRate> {
  const thisWeekStart = startOfKstWeek()
  const lastWeekStart = startOfPreviousKstWeek()
  const now = new Date()

  const [thisWeekIds, lastWeekIds] = await Promise.all([
    collectActiveUserIdsInRange(admin, thisWeekStart, now),
    collectActiveUserIdsInRange(admin, lastWeekStart, thisWeekStart),
  ])

  let returning = 0
  for (const userId of thisWeekIds) {
    if (lastWeekIds.has(userId)) returning++
  }

  const thisWeekActive = thisWeekIds.size
  const ratePercent =
    thisWeekActive === 0 ? null : Math.round((returning / thisWeekActive) * 1000) / 10

  return {
    rate_percent: ratePercent,
    this_week_active: thisWeekActive,
    returning_users: returning,
    note: '이번 주·지난주 활동은 GPS/구매/약관/GPS토글/접속(last_active_at) 로그 기준',
  }
}
