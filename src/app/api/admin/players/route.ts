import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import { loadVerificationSettings } from '@/lib/verification-settings'
import {
  buildGpsLogsByLocation,
  formatAdminDateTime,
  formatValidityPeriod,
  getUserDisplayName,
  orderStatusLabel,
} from '@/lib/admin-players'
import { getEventCourseLabel, getEventGpsLocations, type EventGpsFields } from '@/lib/gps-locations'
import { getMonitorStatus, resolveExpiresAt, formatVerificationDate } from '@/lib/order-verification'
import { buildDuplicateInfoByOrderNumber } from '@/lib/order-duplicate'
import { isInstagramBonusActive } from '@/lib/instagram-follow-bonus'
import {
  getAdminPlayersListCache,
  setAdminPlayersListCache,
} from '@/lib/admin-players-list-cache'
import {
  buildAdminPlayersListRows,
  buildAdminPlayersListSummary,
  filterAdminPlayersListRows,
  paginateAdminPlayersListRows,
  parseAdminPlayersListDir,
  parseAdminPlayersListPage,
  parseAdminPlayersListPageSize,
  parseAdminPlayersListSortKey,
  sortAdminPlayersListRows,
} from '@/lib/admin-players-list-server'

function twelveMonthsAgoDateString(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 12)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  const admin = supabaseAdmin()

  if (userId) {
    const [settings, userResult] = await Promise.all([
      loadVerificationSettings(admin),
      admin.auth.admin.getUserById(userId),
    ])
    const verifiedPeriodDays = settings.verifiedPeriodDays
    const user = userResult.data.user

    if (userResult.error || !user) {
      return NextResponse.json({ error: '선수를 찾을 수 없어요' }, { status: 404 })
    }

    const cutoff = twelveMonthsAgoDateString()
    const now = new Date()

    const [{ data: instagramRows }, { data: termsRows }, { data: orders }, gpsLogsResult, { data: trackingPrefs }, pastEventsResult, { data: upcomingEvents }] =
      await Promise.all([
        admin
          .from('instagram_follow_bonus')
          .select(
            'instagram_handle, status, approved_at, expires_at, manually_unlocked, manual_unlock_verified_mismatch, created_at'
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
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
          .from('user_gps_tracking_prefs')
          .select('event_id, enabled, events(name, date)')
          .eq('user_id', userId),
        admin
          .from('events')
          .select('id, name, date')
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

    let pastEvents: { id: string; name: string; date: string }[] | null =
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
              'id, name, date, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_3_lat, gps_3_lng, gps_3_radius_meters, gps_lat, gps_lng, gps_radius_meters'
            )
            .in('id', gpsEventIds)
        : {
            data: [] as { id: string; name: string; date: string }[],
            error: null,
          }

    let resolvedGpsEvents: { id: string; name: string; date: string }[] | null = gpsEvents
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
    const eventsFromGps = new Map<string, { id: string; name: string; date: string }>()

    for (const log of gpsLogs ?? []) {
      if (!log.event_id) continue
      const meta = eventMetaById.get(log.event_id)
      if (meta?.name && meta?.date && !eventsFromGps.has(log.event_id)) {
        eventsFromGps.set(log.event_id, {
          id: log.event_id,
          name: meta.name,
          date: meta.date,
        })
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

    const historyEventsMap = new Map<string, { id: string; name: string; date: string }>()
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
    const latestPendingInstagram = (instagramRows ?? []).find(row => row.status === 'pending') ?? null
    const approvedInstagramRows = (instagramRows ?? []).filter(row => row.status === 'approved')
    const effectiveInstagram =
      approvedInstagramRows.find(row => isInstagramBonusActive(row, now)) ??
      (instagramRows ?? []).find(
        row => row.status === 'pending' && row.manually_unlocked && isInstagramBonusActive(row, now)
      ) ??
      approvedInstagramRows[0] ??
      null
    const duplicateByOrderNumber = await buildDuplicateInfoByOrderNumber(
      admin,
      (orders ?? []).map(order => order.order_number),
      userId
    )

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
          const configuredLocations = getEventGpsLocations(eventMeta)
          const locationNumbers =
            configuredLocations.length > 0
              ? configuredLocations.map(location => location.locationNumber)
              : [...new Set(eventLogs.map(log => log.location_number ?? 1))].sort(
                  (a, b) => Number(a) - Number(b)
                )
          const locations = buildGpsLogsByLocation(eventLogs, locationNumbers)
          const gpsPassCount = locations.reduce((sum, location) => sum + location.passes.length, 0)

          return {
            event_id: event.id,
            name: event.name,
            date: event.date,
            passed: gpsPassCount > 0,
            gps_pass_count: gpsPassCount,
            location_count: locationNumbers.length || 1,
            course_label: getEventCourseLabel(locationNumbers.length || 1),
            locations,
          }
        }),
        tracking_prefs: (upcomingEvents ?? []).map(event => ({
          event_id: event.id,
          name: event.name,
          date: event.date,
          enabled: prefByEvent.get(event.id) === true,
        })),
        instagram_follow: {
          pending_handle: latestPendingInstagram?.instagram_handle ?? null,
          can_manual_approve:
            latestPendingInstagram?.status === 'pending' &&
            latestPendingInstagram.manually_unlocked !== true &&
            latestPendingInstagram.manual_unlock_verified_mismatch !== true,
          can_mismatch_reapprove:
            latestPendingInstagram?.status === 'pending' &&
            latestPendingInstagram.manually_unlocked !== true &&
            latestPendingInstagram.manual_unlock_verified_mismatch === true,
          manually_unlocked: latestPendingInstagram?.manually_unlocked === true,
          manual_unlock_verified_mismatch:
            latestPendingInstagram?.manual_unlock_verified_mismatch === true,
          approved: !!approvedInstagramRows.length,
          benefit_period_display:
            effectiveInstagram?.approved_at && effectiveInstagram?.expires_at
              ? `${formatVerificationDate(effectiveInstagram.approved_at)} ~ ${formatVerificationDate(effectiveInstagram.expires_at)}`
              : null,
          benefit_active: effectiveInstagram
            ? isInstagramBonusActive(effectiveInstagram, now)
            : false,
        },
        orders: (orders ?? []).map(order => {
          const joined = Array.isArray(order.events) ? order.events[0] : order.events
          const expiresAt = resolveExpiresAt(
            {
              order_number: order.order_number,
              used_at: order.used_at ?? '',
              created_at: order.created_at,
              expires_at: order.expires_at,
            },
            verifiedPeriodDays
          )
          const status =
            Number.isFinite(verifiedPeriodDays) && verifiedPeriodDays > 0
              ? orderStatusLabel(order, verifiedPeriodDays)
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
            ...(duplicateByOrderNumber.get(order.order_number.trim()) ?? {
              is_duplicate: false,
              duplicate_count: 0,
              duplicate_users: [],
            }),
          }
        }),
      },
    })
  }

  const fresh = url.searchParams.get('fresh') === '1'
  const sort = parseAdminPlayersListSortKey(url.searchParams.get('sort'))
  const dir = parseAdminPlayersListDir(url.searchParams.get('dir'))
  const page = parseAdminPlayersListPage(url.searchParams.get('page'))
  const pageSize = parseAdminPlayersListPageSize(url.searchParams.get('page_size'))
  const instagramFollowOnly = url.searchParams.get('instagram_follow_only') === '1'
  const instagramBonusActiveOnly = url.searchParams.get('instagram_bonus_active_only') === '1'
  const instagramManualMismatchOnly =
    url.searchParams.get('instagram_manual_mismatch_only') === '1'

  let fullPlayers = !fresh ? getAdminPlayersListCache() : null
  if (!fullPlayers) {
    const settings = await loadVerificationSettings(admin)
    fullPlayers = await buildAdminPlayersListRows(admin, settings.verifiedPeriodDays)
    setAdminPlayersListCache(fullPlayers)
  }

  const filteredPlayers = filterAdminPlayersListRows(fullPlayers, {
    instagramFollowOnly,
    instagramBonusActiveOnly,
    instagramManualMismatchOnly,
  })
  const sortedPlayers = sortAdminPlayersListRows(filteredPlayers, sort, dir)
  const { players, pagination } = paginateAdminPlayersListRows(sortedPlayers, page, pageSize)
  const summary = buildAdminPlayersListSummary(filteredPlayers, fullPlayers.length)

  return NextResponse.json({ players, summary, pagination })
}
