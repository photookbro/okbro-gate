import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  formatVerificationDate,
  getDaysRemaining,
  getMonitorStatus,
  isUserExpiringSoon,
  resolveExpiresAt,
} from '@/lib/order-verification'
import { formatGpsPassDisplay } from '@/lib/gps-access'
import { buildDuplicateInfoByOrderNumber } from '@/lib/order-duplicate'

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

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const [{ data: orders }, { data: settings }] = await Promise.all([
    admin
      .from('orders')
      .select('id, order_number, platform, used_at, created_at, expires_at, event_id, events(name)')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false }),
    admin.from('settings').select('key, value').eq('key', 'verified_period_months'),
  ])

  const verifiedPeriodMonths = Number(
    settings?.find(s => s?.key === 'verified_period_months')?.value ?? NaN
  )

  const userOrders = (orders as OrderRow[] | null) ?? []
  const duplicateByOrderNumber = await buildDuplicateInfoByOrderNumber(
    admin,
    userOrders.map(order => order.order_number),
    user.id
  )

  const now = new Date()
  const verifications = userOrders.map(order => {
    const joinedEvent = Array.isArray(order.events) ? order.events[0] : order.events
    const verifiedAt = new Date(order.used_at || order.created_at || '')
    const expiresAt = resolveExpiresAt(order, verifiedPeriodMonths)
    const status = expiresAt ? getMonitorStatus(expiresAt, now) : 'expired'

    const duplicate = duplicateByOrderNumber.get(order.order_number.trim()) ?? {
      is_duplicate: false,
      duplicate_count: 0,
      duplicate_users: [],
    }

    return {
      id: order.id,
      event_id: order.event_id,
      event_name: joinedEvent?.name ?? '전체 이용권',
      order_number: order.order_number,
      platform: order.platform,
      verified_at: Number.isNaN(verifiedAt.getTime()) ? null : verifiedAt.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
      days_remaining: expiresAt ? getDaysRemaining(expiresAt, now) : 0,
      status,
      expiring_soon: expiresAt ? isUserExpiringSoon(expiresAt, now) : false,
      is_duplicate: duplicate.is_duplicate,
      duplicate_count: duplicate.duplicate_count,
      duplicate_users: duplicate.duplicate_users,
    }
  })

  const latest = verifications[0]
  const hasExpiringSoon = verifications.some(v => v.expiring_soon)

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
        (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? '알 수 없는 대회'
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
    .select('id, event_id, passed_at, pass_count, notified, events(name)')
    .eq('user_id', user.id)
    .order('passed_at', { ascending: true })

  type GpsEventPassGroup = {
    event_id: string
    event_name: string
    passes: { pass_count: number; display_time: string; passed_at: string }[]
  }

  const gpsEventPassMap = new Map<string, GpsEventPassGroup>()

  for (const log of gpsLogs ?? []) {
    const joined = log.events as { name: string | null } | { name: string | null }[] | null
    const eventName = (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? '알 수 없는 대회'
    if (!log.event_id || !log.passed_at) continue

    let group = gpsEventPassMap.get(log.event_id)
    if (!group) {
      group = {
        event_id: log.event_id,
        event_name: eventName,
        passes: [],
      }
    }

    group.passes.push({
      pass_count: log.pass_count ?? group.passes.length + 1,
      display_time: formatGpsPassDisplay(log.passed_at),
      passed_at: log.passed_at,
    })
    gpsEventPassMap.set(log.event_id, group)
  }

  const gps_event_passes = [...gpsEventPassMap.values()]
    .map(group => ({
      ...group,
      passes: [...group.passes].sort((a, b) => a.pass_count - b.pass_count),
    }))
    .sort(
      (a, b) =>
        new Date(b.passes[b.passes.length - 1]?.passed_at ?? 0).getTime() -
        new Date(a.passes[a.passes.length - 1]?.passed_at ?? 0).getTime()
    )

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
      event_name: joinedEvent?.name ?? '전체 이용권',
      passed_at: verifiedDate.toISOString(),
      display_time: formatGpsPassDisplay(verifiedDate),
      description: '구매',
    })
  }

  shootRecords.sort(
    (a, b) => new Date(b.passed_at).getTime() - new Date(a.passed_at).getTime()
  )

  return NextResponse.json({
    email: user.email,
    latest_verification: latest ?? null,
    verifications,
    has_expiring_soon: hasExpiringSoon,
    event_stats: eventStats,
    gps_event_passes,
    shoot_records: shootRecords,
    formatted: {
      latest_expires_at: latest?.expires_at
        ? formatVerificationDate(latest.expires_at)
        : null,
    },
  })
}
