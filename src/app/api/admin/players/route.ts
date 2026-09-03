import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import { loadVerificationSettings } from '@/lib/verification-settings'
import {
  buildGpsLogsByLocation,
  formatAdminDateTime,
  formatValidityPeriod,
  getUserDisplayName,
  maxIsoDate,
  orderStatusLabel,
} from '@/lib/admin-players'
import { getEventCourseLabel, getEventGpsLocations, type EventGpsFields } from '@/lib/gps-locations'
import { getDaysRemaining, getMonitorStatus, resolveExpiresAt, formatVerificationDate } from '@/lib/order-verification'
import { buildPhotoAccessSummary } from '@/lib/verification-access'
import { buildDuplicateInfoByOrderNumber } from '@/lib/order-duplicate'
import { isInstagramBonusActive } from '@/lib/instagram-follow-bonus'

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
  const denied = requireAdmin(req)
  if (denied) return denied

  const userId = new URL(req.url).searchParams.get('user_id')
  const admin = supabaseAdmin()

  const [{ settings }, authUsers] = await Promise.all([
    loadVerificationSettings(admin).then(settings => ({ settings })),
    listAllAuthUsers(admin),
  ])

  const verifiedPeriodDays = settings.verifiedPeriodDays

  if (userId) {
    const user = authUsers.find(u => u.id === userId)
    if (!user) {
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
            latestPendingInstagram.manually_unlocked !== true,
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

  const [{ data: termsRows }, { data: orders }, { data: gpsLogs }, { data: prefRows }, { data: instagramBonuses }] =
    await Promise.all([
      admin.from('terms_agreements').select('user_id, agreed_at'),
      admin.from('orders').select('user_id, order_number, used_at, created_at, expires_at'),
      admin.from('gps_logs').select('user_id, passed_at'),
      admin.from('user_gps_tracking_prefs').select('user_id, updated_at'),
      admin
        .from('instagram_follow_bonus')
        .select(
          'user_id, instagram_handle, status, approved_at, expires_at, manually_unlocked, manual_unlock_verified_mismatch, created_at'
        )
        .in('status', ['approved', 'pending']),
    ])

  const termsByUser = new Map<string, string>()
  for (const row of termsRows ?? []) {
    if (row.user_id && row.agreed_at) termsByUser.set(row.user_id, row.agreed_at)
  }

  const purchaseValidByUser = new Set<string>()
  const latestPurchaseByUser = new Map<
    string,
    { verified_at: string; expires_at: Date }
  >()
  const ordersByUser = new Map<
    string,
    { order_number: string; used_at?: string | null; created_at?: string | null; expires_at?: string | null }[]
  >()

  for (const order of orders ?? []) {
    if (!order.user_id || !order.order_number) continue
    const list = ordersByUser.get(order.user_id) ?? []
    list.push(order)
    ordersByUser.set(order.user_id, list)
  }

  if (Number.isFinite(verifiedPeriodDays) && verifiedPeriodDays > 0) {
    const now = new Date()
    for (const [userId, userOrders] of ordersByUser) {
      const access = buildPhotoAccessSummary(userOrders, verifiedPeriodDays, null, now)
      if (access.purchase.days_remaining <= 0) continue

      purchaseValidByUser.add(userId)
      if (!access.purchase.expires_at) continue

      const expiresAt = new Date(access.purchase.expires_at)
      const latestOrder = userOrders
        .sort((a, b) => {
          const aExp = resolveExpiresAt(
            {
              order_number: a.order_number,
              used_at: a.used_at ?? '',
              created_at: a.created_at,
              expires_at: a.expires_at,
            },
            verifiedPeriodDays
          )
          const bExp = resolveExpiresAt(
            {
              order_number: b.order_number,
              used_at: b.used_at ?? '',
              created_at: b.created_at,
              expires_at: b.expires_at,
            },
            verifiedPeriodDays
          )
          return (bExp?.getTime() ?? 0) - (aExp?.getTime() ?? 0)
        })[0]
      const verifiedAt = latestOrder?.used_at ?? latestOrder?.created_at
      if (!verifiedAt) continue

      latestPurchaseByUser.set(userId, {
        verified_at: verifiedAt,
        expires_at: expiresAt,
      })
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

  const instagramBonusByUser = new Map<
    string,
    {
      instagram_handle: string
      approved_at: string | null
      expires_at: string | null
      status: string
    }
  >()
  const instagramPendingByUser = new Map<
    string,
    {
      instagram_handle: string
      manually_unlocked: boolean
      manual_unlock_verified_mismatch: boolean
      approved_at: string | null
      expires_at: string | null
      created_at: string
    }
  >()

  for (const row of instagramBonuses ?? []) {
    if (!row.user_id) continue

    if (row.status === 'approved') {
      const prev = instagramBonusByUser.get(row.user_id)
      if (
        !prev ||
        new Date(row.expires_at ?? 0).getTime() > new Date(prev.expires_at ?? 0).getTime()
      ) {
        instagramBonusByUser.set(row.user_id, {
          instagram_handle: row.instagram_handle,
          approved_at: row.approved_at,
          expires_at: row.expires_at,
          status: row.status,
        })
      }
      continue
    }

    if (row.status === 'pending') {
      const prev = instagramPendingByUser.get(row.user_id)
      if (!prev || new Date(row.created_at) > new Date(prev.created_at)) {
        instagramPendingByUser.set(row.user_id, {
          instagram_handle: row.instagram_handle,
          manually_unlocked: row.manually_unlocked === true,
          manual_unlock_verified_mismatch: row.manual_unlock_verified_mismatch === true,
          approved_at: row.approved_at,
          expires_at: row.expires_at,
          created_at: row.created_at,
        })
      }
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
    const verification = latestPurchaseByUser.get(user.id)
    const instagramBonus = instagramBonusByUser.get(user.id)
    const instagramPending = instagramPendingByUser.get(user.id)
    const effectiveInstagram =
      instagramBonus && isInstagramBonusActive(instagramBonus, now)
        ? instagramBonus
        : instagramPending?.manually_unlocked && isInstagramBonusActive(instagramPending, now)
          ? instagramPending
          : instagramBonus ?? (instagramPending?.manually_unlocked ? instagramPending : null)
    const instagramHandle =
      instagramBonus?.instagram_handle ?? instagramPending?.instagram_handle ?? null
    const access = buildPhotoAccessSummary(
      ordersByUser.get(user.id) ?? [],
      verifiedPeriodDays,
      effectiveInstagram?.expires_at ?? instagramBonus?.expires_at ?? null,
      now
    )
    const instagramBonusActive =
      !!effectiveInstagram?.expires_at && isInstagramBonusActive(effectiveInstagram, now)
    const instagramBonusDaysRemaining =
      effectiveInstagram?.expires_at && instagramBonusActive
        ? getDaysRemaining(new Date(effectiveInstagram.expires_at), now)
        : null

    let instagramBenefitLabel = '-'
    if (effectiveInstagram?.expires_at) {
      if (instagramBonusActive && instagramBonusDaysRemaining != null) {
        instagramBenefitLabel = `D-${instagramBonusDaysRemaining}`
      } else {
        instagramBenefitLabel = '만료됨'
      }
    }

    return {
      id: user.id,
      name: getUserDisplayName(user),
      email: user.email ?? '-',
      joined_at: user.created_at,
      joined_at_display: formatAdminDateTime(user.created_at),
      terms_agreed: termsByUser.has(user.id),
      purchase_verified: purchaseValidByUser.has(user.id),
      gps_record: gpsByUser.has(user.id),
      instagram_follow_verified: !!instagramBonus || instagramBonusActive,
      instagram_follow_pending: !!instagramPending,
      instagram_can_manual_approve:
        !!instagramPending && !instagramPending.manually_unlocked,
      instagram_manually_unlocked: instagramPending?.manually_unlocked === true,
      instagram_manual_unlock_mismatch: instagramPending?.manual_unlock_verified_mismatch === true,
      instagram_handle: instagramHandle,
      instagram_benefit_label: instagramBenefitLabel,
      instagram_benefit_period_display:
        effectiveInstagram?.approved_at && effectiveInstagram?.expires_at
          ? `${formatVerificationDate(effectiveInstagram.approved_at)} ~ ${formatVerificationDate(effectiveInstagram.expires_at)}`
          : '-',
      instagram_bonus_active: instagramBonusActive,
      verified_at_display: verification ? formatVerificationDate(verification.verified_at) : '-',
      expires_at_display: verification ? formatVerificationDate(verification.expires_at) : '-',
      days_remaining: verification ? getDaysRemaining(verification.expires_at, now) : null,
      photo_access_days_remaining: access.photo_access_days_remaining,
      last_activity: lastActivity,
      last_activity_display: lastActivity ? formatAdminDateTime(lastActivity) : '-',
    }
  })

  const instagramFollowOnly = new URL(req.url).searchParams.get('instagram_follow_only') === '1'
  const instagramBonusActiveOnly =
    new URL(req.url).searchParams.get('instagram_bonus_active_only') === '1'

  let filteredPlayers = players
  if (instagramFollowOnly) {
    filteredPlayers = filteredPlayers.filter(player => player.instagram_follow_verified)
  }
  if (instagramBonusActiveOnly) {
    filteredPlayers = filteredPlayers.filter(player => player.instagram_bonus_active)
  }

  const summary = {
    total_signups: filteredPlayers.length,
    terms_agreed: filteredPlayers.filter(player => player.terms_agreed).length,
    purchase_verified: filteredPlayers.filter(player => player.purchase_verified).length,
    gps_users: filteredPlayers.filter(player => player.gps_record).length,
    instagram_follow_verified: filteredPlayers.filter(player => player.instagram_follow_verified).length,
    instagram_bonus_active: filteredPlayers.filter(player => player.instagram_bonus_active).length,
  }

  filteredPlayers.sort((a, b) => {
    const aMs = a.last_activity ? new Date(a.last_activity).getTime() : 0
    const bMs = b.last_activity ? new Date(b.last_activity).getTime() : 0
    return bMs - aMs
  })

  return NextResponse.json({ players: filteredPlayers, summary })
}
