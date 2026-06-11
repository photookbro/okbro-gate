import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import {
  getDaysRemaining,
  getMonitorStatus,
  resolveExpiresAt,
} from '@/lib/order-verification'

type OrderRow = {
  id: string
  user_id: string
  order_number: string
  platform: string
  used_at: string
  created_at?: string | null
  expires_at?: string | null
  expiry_notified_at?: string | null
  event_id?: string | null
  users?: { email: string | null } | { email: string | null }[] | null
  events?: { name: string | null } | { name: string | null }[] | null
}

async function buildEmailMap(admin: ReturnType<typeof supabaseAdmin>) {
  const emailByUserId = new Map<string, string>()

  const { data: usersRows } = await admin.from('users').select('id, email')
  for (const user of usersRows ?? []) {
    if (user.id && user.email) {
      emailByUserId.set(user.id, user.email)
    }
  }

  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break

    for (const user of data.users) {
      if (user.id && user.email) {
        emailByUserId.set(user.id, user.email)
      }
    }

    if (data.users.length < perPage) break
    page++
  }

  return emailByUserId
}

async function fetchOrders(admin: ReturnType<typeof supabaseAdmin>) {
  const joined = await admin
    .from('orders')
    .select(
      'id, user_id, order_number, platform, used_at, created_at, expires_at, expiry_notified_at, event_id, users(email), events(name)'
    )
    .order('used_at', { ascending: false })

  if (!joined.error) {
    return joined.data as OrderRow[] | null
  }

  const plain = await admin
    .from('orders')
    .select(
      'id, user_id, order_number, platform, used_at, created_at, expires_at, expiry_notified_at, event_id'
    )
    .order('used_at', { ascending: false })

  if (plain.error) return null
  return plain.data as OrderRow[] | null
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const admin = supabaseAdmin()
  const orders = await fetchOrders(admin)

  if (!orders) {
    return NextResponse.json({ error: '모니터링 데이터 조회 실패' }, { status: 500 })
  }

  const { data: settings } = await admin
    .from('settings')
    .select('key, value')
    .eq('key', 'verified_period_months')

  const verifiedPeriodMonths = Number(
    settings?.find(s => s?.key === 'verified_period_months')?.value ?? NaN
  )

  if (!Number.isFinite(verifiedPeriodMonths) || verifiedPeriodMonths <= 0) {
    return NextResponse.json({ error: '인증 기간 설정을 확인할 수 없어요' }, { status: 500 })
  }

  const emailByUserId = await buildEmailMap(admin)
  const now = new Date()

  const rows = orders.map(order => {
    const verifiedAt = new Date(order.used_at || order.created_at || '')
    const expiresAt = resolveExpiresAt(order, verifiedPeriodMonths)
    const status =
      !expiresAt || Number.isNaN(verifiedAt.getTime())
        ? ('expired' as const)
        : getMonitorStatus(expiresAt, now)

    const joinedUser = Array.isArray(order.users) ? order.users[0] : order.users
    const joinedEvent = Array.isArray(order.events) ? order.events[0] : order.events
    const email =
      joinedUser?.email ??
      emailByUserId.get(order.user_id) ??
      '-'

    return {
      id: order.id,
      user_id: order.user_id,
      email,
      order_number: order.order_number,
      platform: order.platform,
      event_name: joinedEvent?.name ?? '전체 이용권',
      verified_at: Number.isNaN(verifiedAt.getTime()) ? null : verifiedAt.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
      days_remaining: expiresAt ? getDaysRemaining(expiresAt, now) : 0,
      status,
      notification_sent: !!order.expiry_notified_at,
    }
  })

  const userStatuses = new Map<string, ReturnType<typeof getMonitorStatus>>()
  for (const row of rows) {
    const current = userStatuses.get(row.user_id)
    const priority = { active: 0, expiring_soon: 1, expired: 2 }
    if (!current || priority[row.status] < priority[current]) {
      userStatuses.set(row.user_id, row.status)
    }
  }

  let activeUsers = 0
  let expiringSoonUsers = 0
  for (const status of userStatuses.values()) {
    if (status === 'active') activeUsers++
    if (status === 'expiring_soon') expiringSoonUsers++
  }

  const expiringSoon = rows.filter(row => row.status === 'expiring_soon')

  const { data: termsRows, error: termsError } = await admin
    .from('terms_agreements')
    .select('id, user_id, agreed_at, ip_address, user_agent, version')
    .order('agreed_at', { ascending: false })

  if (termsError) {
    return NextResponse.json({ error: '약관 동의 데이터 조회 실패' }, { status: 500 })
  }

  const termsAgreements = (termsRows ?? []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    email: emailByUserId.get(row.user_id) ?? '-',
    agreed_at: row.agreed_at,
    ip_address: row.ip_address ?? '-',
    user_agent: row.user_agent ?? '-',
    version: row.version,
  }))

  const termsAgreedUserIds = new Set((termsRows ?? []).map(row => row.user_id))

  return NextResponse.json({
    summary: {
      total_verified_users: userStatuses.size,
      active_users: activeUsers,
      expiring_soon_users: expiringSoonUsers,
      total_terms_agreed_users: termsAgreedUserIds.size,
    },
    expiring_soon: expiringSoon,
    terms_agreements: termsAgreements,
    users: rows,
  })
}
