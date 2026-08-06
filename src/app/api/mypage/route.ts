import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  formatVerificationDate,
  getDaysRemaining,
  getMonitorStatus,
  isUserExpiringSoon,
  resolveExpiresAt,
  USER_EXPIRY_WARNING_DAYS,
} from '@/lib/order-verification'
import { buildPhotoAccessSummary } from '@/lib/verification-access'
import { groupGpsLogsByLocation, formatGpsPassDisplay } from '@/lib/gps-access'
import { buildDuplicateInfoByOrderNumber } from '@/lib/order-duplicate'
import { loadVerificationSettings } from '@/lib/verification-settings'
import {
  buildInstagramFollowBonusStatus,
  getApprovedInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
} from '@/lib/instagram-follow-bonus'
import { ensureUserProfile } from '@/lib/user-profile-server'

type OrderRow = {
  id: string
  order_number: string
  platform: string
  used_at: string
  created_at?: string | null
  expires_at?: string | null
  event_id?: string | null
  events?: { name: string | null } | { name: string | null }[] | null
}

export async function GET(req: NextRequest) {
  try {
    return await getMypage(req)
  } catch (error) {
    console.error('[mypage]', error)
    return NextResponse.json(
      { error: '????? ??? ???? ????' },
      { status: 500 }
    )
  }
}

async function getMypage(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '???? ????' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const [{ data: orders }, settings] = await Promise.all([
    admin
      .from('orders')
      .select('id, order_number, platform, used_at, created_at, expires_at, event_id, events(name)')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false }),
    loadVerificationSettings(admin),
  ])

  const verifiedPeriodDays = settings.verifiedPeriodDays

  const userOrders = (orders as OrderRow[] | null) ?? []
  const duplicateByOrderNumber = await buildDuplicateInfoByOrderNumber(
    admin,
    userOrders.map(order => order.order_number),
    user.id
  )

  const now = new Date()

  let instagramFollowBonus = buildInstagramFollowBonusStatus(
    null,
    null,
    settings.instagramFollowBonusDays,
    now
  )

  try {
    await ensureUserProfile(admin, user.id, user.created_at ?? new Date().toISOString())
    const [approvedInstagramBonus, latestInstagramAttempt] = await Promise.all([
      getApprovedInstagramFollowBonus(admin, user.id),
      getLatestInstagramFollowBonusAttempt(admin, user.id),
    ])
    instagramFollowBonus = buildInstagramFollowBonusStatus(
      approvedInstagramBonus,
      latestInstagramAttempt,
      settings.instagramFollowBonusDays,
      now
    )
  } catch (error) {
    // profiles / instagram_follow_bonus ?????? ??? ??? ?????? ??
    console.error('[mypage] instagram follow bonus unavailable:', error)
  }

  const photoAccess = buildPhotoAccessSummary(userOrders, verifiedPeriodDays, now)

  const verifications = userOrders.map(order => {
    const joinedEvent = Array.isArray(order.events) ? order.events[0] : order.events
    const verifiedAt = new Date(order.used_at || order.created_at || '')
    const expiresAt = resolveExpiresAt(order, verifiedPeriodDays)
    const status = expiresAt ? getMonitorStatus(expiresAt, now) : 'expired'

    const duplicate = duplicateByOrderNumber.get(order.order_number.trim()) ?? {
      is_duplicate: false,
      duplicate_count: 0,
      duplicate_users: [],
    }

    return {
      id: order.id,
      event_id: order.event_id,
      event_name: joinedEvent?.name ?? '?? ???',
      order_number: order.order_number,
      platform: order.platform,
      verified_at: Number.isNaN(verifiedAt.getTime()) ? null : verifiedAt.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
      days_remaining: expiresAt ? getDaysRemaining(expiresAt, now) : 0,
      status,
      expiring_soon: expiresAt ? isUserExpiringSoon(expiresAt, now) : false,
      is_duplicate: duplicate.is_duplicate,
      duplicate_count: duplicate.duplicate_count,
    }
  })

  const latest = verifications[0]
  const hasExpiringSoon =
    photoAccess.photo_access_days_remaining > 0 &&
    photoAccess.photo_access_days_remaining <= USER_EXPIRY_WARNING_DAYS

  const { data: downloads } = await admin
    .from('downloads')
    .select('photo_id')
    .eq('user_id', user.id)

  const photoIds = (downloads ?? []).map(d => d.photo_id).filter(Boolean)
  const eventDownloadCounts: Record<string, { event_id: string; event_name: string; count: number }> = {}

  if (photoIds.length > 0) {
    const { data: photos } = await admin
      .from('photos')
      .select('id, event_id, events(name)')
      .in('id', photoIds)

    for (const photo of photos ?? []) {
      if (!photo.event_id) continue
      const joined = photo.events as { name: string | null } | { name: string | null }[] | null
      const eventName =
        (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? '? ? ?? ??'
      if (!eventDownloadCounts[photo.event_id]) {
        eventDownloadCounts[photo.event_id] = {
          event_id: photo.event_id,
          event_name: eventName,
          count: 0,
        }
      }
      eventDownloadCounts[photo.event_id].count++
    }
  }

  const orderCountsByEvent: Record<string, number> = {}
  for (const order of orders ?? []) {
    if (!order.event_id) continue
    orderCountsByEvent[order.event_id] = (orderCountsByEvent[order.event_id] ?? 0) + 1
  }

  const { data: events } = await admin.from('events').select('id, name').order('date', {
    ascending: false,
  })

  const eventStats = (events ?? [])
    .map(event => ({
      event_id: event.id,
      event_name: event.name,
      download_count: eventDownloadCounts[event.id]?.count ?? 0,
      order_count: orderCountsByEvent[event.id] ?? 0,
    }))
    .filter(e => e.download_count > 0 || e.order_count > 0)

  const { data: gpsLogs } = await admin
    .from('gps_logs')
    .select(
      'id, event_id, passed_at, pass_count, location_number, notified, events(name, date)'
    )
    .eq('user_id', user.id)
    .order('passed_at', { ascending: true })

  type GpsEventPassGroup = {
    event_id: string
    event_name: string
    event_date: string | null
    logs: { location_number: number | null; pass_count: number | null; passed_at: string | null }[]
  }

  const gpsEventPassMap = new Map<string, GpsEventPassGroup>()

  for (const log of gpsLogs ?? []) {
    const joined = log.events as
      | { name: string | null; date: string | null }
      | { name: string | null; date: string | null }[]
      | null
    const eventMeta = Array.isArray(joined) ? joined[0] : joined
    if (!log.event_id || !log.passed_at) continue

    let group = gpsEventPassMap.get(log.event_id)
    if (!group) {
      group = {
        event_id: log.event_id,
        event_name: eventMeta?.name ?? '? ? ?? ??',
        event_date: typeof eventMeta?.date === 'string' ? eventMeta.date : null,
        logs: [],
      }
      gpsEventPassMap.set(log.event_id, group)
    }

    group.logs.push({
      location_number: log.location_number,
      pass_count: log.pass_count,
      passed_at: log.passed_at,
    })
  }

  const gps_event_passes = [...gpsEventPassMap.values()]
    .map(group => {
      const locations = groupGpsLogsByLocation(group.logs)
      const latestPassedAt = locations
        .flatMap(location => location.passes)
        .reduce((latest, pass) => (pass.passed_at > latest ? pass.passed_at : latest), '')

      return {
        event: {
          event_id: group.event_id,
          event_name: group.event_name,
          event_date: group.event_date,
          locations,
        },
        latestPassedAt,
      }
    })
    .sort((a, b) => new Date(b.latestPassedAt).getTime() - new Date(a.latestPassedAt).getTime())
    .map(({ event }) => event)

  type ShootRecord = {
    type: 'purchase'
    event_id: string | null
    event_name: string
    passed_at: string
    display_time: string
    description: string
  }

  const shootRecords: ShootRecord[] = []

  for (const order of orders ?? []) {
    const joinedEvent = Array.isArray(order.events) ? order.events[0] : order.events
    const verifiedAt = order.used_at || order.created_at
    if (!verifiedAt) continue
    const verifiedDate = new Date(verifiedAt)
    if (Number.isNaN(verifiedDate.getTime())) continue
    shootRecords.push({
      type: 'purchase',
      event_id: order.event_id ?? null,
      event_name: joinedEvent?.name ?? '?? ???',
      passed_at: verifiedDate.toISOString(),
      display_time: formatGpsPassDisplay(verifiedDate),
      description: '??',
    })
  }

  shootRecords.sort(
    (a, b) => new Date(b.passed_at).getTime() - new Date(a.passed_at).getTime()
  )

  return NextResponse.json({
    email: user.email,
    photo_access: {
      purchase_days_remaining: photoAccess.purchase.days_remaining,
      photo_access_days_remaining: photoAccess.photo_access_days_remaining,
      purchase_validity_label: photoAccess.purchase.validity_label,
      status: photoAccess.status,
      expiring_soon: hasExpiringSoon,
    },
    latest_verification: latest ?? null,
    verifications,
    has_expiring_soon: hasExpiringSoon,
    event_stats: eventStats,
    gps_event_passes,
    shoot_records: shootRecords,
    instagram_follow_bonus: instagramFollowBonus,
    formatted: {
      latest_expires_at: latest?.expires_at
        ? formatVerificationDate(latest.expires_at)
        : null,
    },
  })
}
