import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import {
  buildGpsLogsByLocation,
  formatAdminDateTime,
  formatValidityPeriod,
  getUserDisplayName,
  maxIsoDate,
  maxPassesForEvent,
  orderStatusLabel,
} from '@/lib/admin-players'
import { getEventCourseLabel, getEventGpsLocations, type EventGpsFields } from '@/lib/gps-locations'
import { getDaysRemaining, getMonitorStatus, resolveExpiresAt, formatVerificationDate } from '@/lib/order-verification'

async function listAllAuthUsers(admin: ReturnType<typeof supabaseAdmin>): Promise<User[]> {
  const users: User[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return users
}

function twelveMonthsAgoDateString(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const userId = new URL(req.url).searchParams.get('user_id')
  const admin = supabaseAdmin()

  const [{ data: settings }, authUsers] = await Promise.all([
    admin.from('settings').select('key, value').eq('key', 'verified_period_months'),
    listAllAuthUsers(admin),
  ])

  const verifiedPeriodMonths = Number(
    settings?.find(s => s?.key === 'verified_period_months')?.value ?? NaN
  )

  if (userId) {
    const user = authUsers.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ error: '선수를 찾을 수 없어요' }, { status: 404 })
    }

    const cutoff = twelveMonthsAgoDateString()
    const now = new Date()

    const [
      { data: termsRows },
      { data: orders },
      gpsLogsResult,
      { data: trackingPrefs },
      pastEventsResult,
      { data: upcomingEvents },
    ] = await Promise.all([
      admin
        .from('terms_agreements')
        .select('agreed_at, version')
        .eq('user_id', userId)
        .order('agreed_at', { ascending: false })
        .limit(1),
      admin
        .from('orders')
        .select('id, order_number, platform, used_at, created_at, expires_at, event_id, events(name)')
        .eq('user_id', userId)
        .order('used_at', { ascending: false }),
      admin
        .from('gps_logs')
        .select('event_id, passed_at, pass_count, location_number, notified')
        .eq('user_id', userId)
        .order('passed_at', { ascending: true }),
      admin
        .from('gps_tracking_prefs')
        .select('event_id, enabled, events(name, date)')
        .eq('user_id', userId),
      admin
        .from('events')
        .select('id, name, date, is_loop_course')
        .not('album_b_url', 'is', null)
        .neq('album_b_url', '')
        .gte('date', cutoff)
        .order('date', { ascending: false }),
      admin
        .from('events')
        .select('id, name, date')
        .or('album_b_url.is.null,album_b_url.eq.')
        .order('date', { ascending: true }),
    ])

    let gpsLogs = gpsLogsResult.data
    if (gpsLogsResult.error) {
      const fallback = await admin
        .from('gps_logs')
        .select('event_id, passed_at, notified')
        .eq('user_id', userId)
        .order('passed_at', { ascending: true })
      gpsLogs = (fallback.data ?? []).map((log, index) => ({
        ...log,
        pass_count: index + 1,
        location_number: 1,
      }))
    }

    let pastEvents: { id: string; name: string; date: string; is_loop_course?: boolean | null }[] | null =
      pastEventsResult.data
    if (pastEventsResult.error) {
      const fallback = await admin
        .from('events')
        .select('id, name, date')
        .not('album_b_url', 'is', null)
        .neq('album_b_url', '')
        .gte('date', cutoff)
        .order('date', { ascending: false })
      pastEvents = fallback.data
    }

    const gpsEventIds = [...new Set((gpsLogs ?? []).map(log => log.event_id).filter(Boolean))] as string[]
    const { data: gpsEvents, error: gpsEventsError } =
      gpsEventIds.length > 0
        ? await admin
            .from('events')
            .select(
              'id, name, date, is_loop_course, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters'
            )
            .in('id', gpsEventIds)
        : {
            data: [] as {
              id: string
              name: string
              date: string
              is_loop_course?: boolean | null
            }[],
            error: null,
          }

    let resolvedGpsEvents: { id: string; name: string; date: string; is_loop_course?: boolean | null }[] | null =
      gpsEvents
    if (gpsEventsError && gpsEventIds.length > 0) {
      const fallback = await admin.from('events').select('id, name, date').in('id', gpsEventIds)
      resolvedGpsEvents = fallback.data
    }

    const eventMetaById = new Map(
      (resolvedGpsEvents ?? []).map(event => [event.id, event] as const)
    )

    const gpsLogsByEvent = new Map<
      string,
      {
        pass_count?: number | null
        passed_at?: string | null
        notified?: boolean | null
        location_number?: number | null
      }[]
    >()
    const loopCourseByEvent = new Map<string, boolean>()
    const eventsFromGps = new Map<
      string,
      { id: string; name: string; date: string; is_loop_course?: boolean | null }
    >()

    for (const log of gpsLogs ?? []) {
      if (!log.event_id) continue
      const meta = eventMetaById.get(log.event_id)
      if (meta?.name && meta?.date && !eventsFromGps.has(log.event_id)) {
        eventsFromGps.set(log.event_id, {
          id: log.event_id,
          name: meta.name,
          date: meta.date,
          is_loop_course: meta.is_loop_course,
        })
      }
      if (meta?.is_loop_course != null) {
        loopCourseByEvent.set(log.event_id, meta.is_loop_course === true)
      }
      const list = gpsLogsByEvent.get(log.event_id) ?? []
      list.push({
        pass_count: log.pass_count,
        passed_at: log.passed_at,
        notified: log.notified,
        location_number: log.location_number ?? 1,
      })
      gpsLogsByEvent.set(log.event_id, list)
    }

    const historyEventsMap = new Map<
      string,
      { id: string; name: string; date: string; is_loop_course?: boolean | null }
    >()
    for (const event of pastEvents ?? []) {
      historyEventsMap.set(event.id, event)
    }
    for (const [eventId, event] of eventsFromGps) {
      if (!historyEventsMap.has(eventId)) {
        historyEventsMap.set(eventId, event)
      }
    }
    const historyEvents = Array.from(historyEventsMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    )

    const prefByEvent = new Map<string, boolean>()
    for (const pref of trackingPrefs ?? []) {
      if (pref.event_id) prefByEvent.set(pref.event_id, pref.enabled === true)
    }

    const terms = termsRows?.[0]

    return NextResponse.json({
      player: {
        id: user.id,
        name: getUserDisplayName(user),
        email: user.email ?? '-',
        joined_at: user.created_at,
        joined_at_display: formatAdminDateTime(user.created_at),
        terms: {
          agreed: !!terms,
          agreed_at: terms?.agreed_at ?? null,
          agreed_at_display: terms?.agreed_at ? formatAdminDateTime(terms.agreed_at) : null,
          version: terms?.version ?? null,
        },
        event_history: historyEvents.map(event => {
          const eventLogs = gpsLogsByEvent.get(event.id) ?? []
          const eventMeta = (eventMetaById.get(event.id) ?? event) as EventGpsFields
          const isLoopCourse =
            event.is_loop_course === true || loopCourseByEvent.get(event.id) === true
          const maxPasses = maxPassesForEvent(isLoopCourse)
          const configuredLocations = getEventGpsLocations(eventMeta)
          const locationNumbers =
            configuredLocations.length > 0
              ? configuredLocations.map(location => location.locationNumber)
              : [...new Set(eventLogs.map(log => log.location_number ?? 1))].sort()
          const locations = buildGpsLogsByLocation(eventLogs, maxPasses, locationNumbers)
          const gpsPassCount = locations.reduce(
            (sum, location) => sum + location.passes.filter(slot => slot.passed_at_display).length,
            0
          )

          return {
            event_id: event.id,
            name: event.name,
            date: event.date,
            passed: gpsPassCount > 0,
            gps_pass_count: gpsPassCount,
            is_loop_course: isLoopCourse,
            location_count: locationNumbers.length || 1,
            course_label: getEventCourseLabel(isLoopCourse, locationNumbers.length || 1),
            max_passes: maxPasses,
            locations,
          }
        }),
        tracking_prefs: (upcomingEvents ?? []).map(event => ({
          event_id: event.id,
          name: event.name,
          date: event.date,
          enabled: prefByEvent.get(event.id) === true,
        })),
        orders: (orders ?? []).map(order => {
          const joined = Array.isArray(order.events) ? order.events[0] : order.events
          const expiresAt = resolveExpiresAt(
            {
              order_number: order.order_number,
              used_at: order.used_at ?? '',
              created_at: order.created_at,
              expires_at: order.expires_at,
            },
            verifiedPeriodMonths
          )
          const status =
            Number.isFinite(verifiedPeriodMonths) && verifiedPeriodMonths > 0
              ? orderStatusLabel(order, verifiedPeriodMonths)
              : '만료'

          return {
            id: order.id,
            order_number: order.order_number,
            platform: order.platform,
            event_name: joined?.name ?? '전체 이용권',
            verified_at: order.used_at,
            verified_at_display: formatAdminDateTime(order.used_at),
            expires_at: expiresAt?.toISOString() ?? null,
            expires_at_display: expiresAt ? formatAdminDateTime(expiresAt) : '-',
            validity_period_display: formatValidityPeriod(order.used_at, expiresAt),
            status,
            is_valid: expiresAt ? getMonitorStatus(expiresAt, now) !== 'expired' : false,
          }
        }),
      },
    })
  }

  const [{ data: termsRows }, { data: orders }, { data: gpsLogs }, { data: prefRows }] =
    await Promise.all([
      admin.from('terms_agreements').select('user_id, agreed_at'),
      admin.from('orders').select('user_id, used_at, created_at, expires_at'),
      admin.from('gps_logs').select('user_id, passed_at'),
      admin.from('gps_tracking_prefs').select('user_id, updated_at'),
    ])

  const termsByUser = new Map<string, string>()
  for (const row of termsRows ?? []) {
    if (row.user_id && row.agreed_at) termsByUser.set(row.user_id, row.agreed_at)
  }

  const purchaseValidByUser = new Set<string>()
  const latestVerificationByUser = new Map<
    string,
    { verified_at: string; expires_at: Date }
  >()
  if (Number.isFinite(verifiedPeriodMonths) && verifiedPeriodMonths > 0) {
    const now = new Date()
    for (const order of orders ?? []) {
      if (!order.user_id) continue
      const verifiedAt = order.used_at ?? order.created_at
      const expiresAt = resolveExpiresAt(
        {
          order_number: '',
          used_at: order.used_at ?? '',
          created_at: order.created_at,
          expires_at: order.expires_at,
        },
        verifiedPeriodMonths
      )
      if (!verifiedAt || !expiresAt) continue

      const existing = latestVerificationByUser.get(order.user_id)
      if (!existing || expiresAt > existing.expires_at) {
        latestVerificationByUser.set(order.user_id, {
          verified_at: verifiedAt,
          expires_at: expiresAt,
        })
      }

      if (getMonitorStatus(expiresAt, now) !== 'expired') {
        purchaseValidByUser.add(order.user_id)
      }
    }
  }

  const gpsByUser = new Set<string>()
  const gpsActivityByUser = new Map<string, string>()
  for (const log of gpsLogs ?? []) {
    if (!log.user_id) continue
    gpsByUser.add(log.user_id)
    if (!log.passed_at) continue
    const prev = gpsActivityByUser.get(log.user_id)
    if (!prev || new Date(log.passed_at) > new Date(prev)) {
      gpsActivityByUser.set(log.user_id, log.passed_at)
    }
  }

  const orderActivityByUser = new Map<string, string>()
  for (const order of orders ?? []) {
    if (!order.user_id) continue
    const activity = order.used_at ?? order.created_at
    if (!activity) continue
    const prev = orderActivityByUser.get(order.user_id)
    if (!prev || new Date(activity) > new Date(prev)) {
      orderActivityByUser.set(order.user_id, activity)
    }
  }

  const prefUpdatedByUser = new Map<string, string>()
  for (const pref of prefRows ?? []) {
    if (!pref.user_id || !pref.updated_at) continue
    const prev = prefUpdatedByUser.get(pref.user_id)
    if (!prev || new Date(pref.updated_at) > new Date(prev)) {
      prefUpdatedByUser.set(pref.user_id, pref.updated_at)
    }
  }

  const now = new Date()

  const players = authUsers.map(user => {
    const lastActivity = maxIsoDate(
      termsByUser.get(user.id),
      orderActivityByUser.get(user.id),
      gpsActivityByUser.get(user.id),
      prefUpdatedByUser.get(user.id),
      user.last_sign_in_at
    )
    const verification = latestVerificationByUser.get(user.id)

    return {
      id: user.id,
      name: getUserDisplayName(user),
      email: user.email ?? '-',
      joined_at: user.created_at,
      joined_at_display: formatAdminDateTime(user.created_at),
      terms_agreed: termsByUser.has(user.id),
      purchase_verified: purchaseValidByUser.has(user.id),
      gps_record: gpsByUser.has(user.id),
      verified_at_display: verification ? formatVerificationDate(verification.verified_at) : '-',
      expires_at_display: verification ? formatVerificationDate(verification.expires_at) : '-',
      days_remaining: verification ? getDaysRemaining(verification.expires_at, now) : null,
      last_activity: lastActivity,
      last_activity_display: lastActivity ? formatAdminDateTime(lastActivity) : '-',
    }
  })

  const summary = {
    total_signups: players.length,
    terms_agreed: players.filter(player => player.terms_agreed).length,
    purchase_verified: players.filter(player => player.purchase_verified).length,
    gps_users: players.filter(player => player.gps_record).length,
  }

  players.sort((a, b) => {
    const aMs = a.last_activity ? new Date(a.last_activity).getTime() : 0
    const bMs = b.last_activity ? new Date(b.last_activity).getTime() : 0
    return bMs - aMs
  })

  return NextResponse.json({ players, summary })
}
