import type { SupabaseClient } from '@supabase/supabase-js'
import { listAllAuthUsers } from '@/lib/admin-auth-users'
import {
  fetchAllSupabaseRows,
  formatAdminDateTime,
  getUserDisplayName,
  maxIsoDate,
} from '@/lib/admin-players'
import { isInstagramBonusActive } from '@/lib/instagram-follow-bonus'
import { getDaysRemaining, formatVerificationDate, resolveExpiresAt } from '@/lib/order-verification'
import { buildPhotoAccessSummary } from '@/lib/verification-access'

export type AdminPlayerListRow = {
  id: string
  name: string
  email: string
  joined_at: string
  joined_at_display: string
  terms_agreed: boolean
  purchase_verified: boolean
  gps_record: boolean
  instagram_follow_verified: boolean
  instagram_follow_pending: boolean
  instagram_can_manual_approve: boolean
  instagram_can_mismatch_reapprove: boolean
  instagram_manually_unlocked: boolean
  instagram_manual_unlock_mismatch: boolean
  instagram_handle: string | null
  instagram_benefit_label: string
  instagram_benefit_period_display: string
  instagram_bonus_active: boolean
  verified_at_display: string
  expires_at_display: string
  days_remaining: number | null
  photo_access_days_remaining: number
  last_activity: string | null
  last_activity_display: string
}

export type AdminPlayersListFilters = {
  instagramFollowOnly?: boolean
  instagramBonusActiveOnly?: boolean
  instagramManualMismatchOnly?: boolean
}

export type AdminPlayersListSortKey =
  | 'name'
  | 'email'
  | 'joined_at'
  | 'terms_agreed'
  | 'purchase_verified'
  | 'gps_record'
  | 'instagram_follow_verified'
  | 'instagram_handle'
  | 'instagram_manual_approve'
  | 'instagram_manual_unlock_mismatch'
  | 'instagram_benefit_period_display'
  | 'verified_at_display'
  | 'expires_at_display'
  | 'photo_access_days_remaining'
  | 'last_activity'

const SORT_KEYS = new Set<string>([
  'name',
  'email',
  'joined_at',
  'terms_agreed',
  'purchase_verified',
  'gps_record',
  'instagram_follow_verified',
  'instagram_handle',
  'instagram_manual_approve',
  'instagram_manual_unlock_mismatch',
  'instagram_benefit_period_display',
  'verified_at_display',
  'expires_at_display',
  'photo_access_days_remaining',
  'last_activity',
])

export function parseAdminPlayersListSortKey(raw: string | null): AdminPlayersListSortKey {
  if (raw && SORT_KEYS.has(raw)) return raw as AdminPlayersListSortKey
  return 'joined_at'
}

export function parseAdminPlayersListDir(raw: string | null): 'asc' | 'desc' {
  return raw === 'asc' ? 'asc' : 'desc'
}

export function parseAdminPlayersListPage(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function parseAdminPlayersListPageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.min(n, 200)
}

/** 추가 승인(불일치) → 자동 승인 → 즉시 승인(잔여 pending) → 해당 없음 */
function instagramManualApproveSortRank(player: AdminPlayerListRow): number {
  if (player.instagram_can_mismatch_reapprove) return 0
  if (player.instagram_manually_unlocked) return 1
  if (player.instagram_can_manual_approve) return 2
  return 3
}

export async function buildAdminPlayersListRows(
  admin: SupabaseClient,
  verifiedPeriodDays: number
): Promise<AdminPlayerListRow[]> {
  const authUsers = await listAllAuthUsers(admin)

  const [termsRows, orders, gpsLogs, prefRows, instagramBonuses] = await Promise.all([
    fetchAllSupabaseRows<{ user_id: string; agreed_at: string | null }>((from, to) =>
      admin.from('terms_agreements').select('user_id, agreed_at').range(from, to)
    ),
    fetchAllSupabaseRows<{
      user_id: string
      order_number: string
      used_at: string | null
      created_at: string | null
      expires_at: string | null
    }>((from, to) =>
      admin
        .from('orders')
        .select('user_id, order_number, used_at, created_at, expires_at')
        .range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; passed_at: string | null }>((from, to) =>
      admin.from('gps_logs').select('user_id, passed_at').range(from, to)
    ),
    fetchAllSupabaseRows<{ user_id: string; updated_at: string | null }>((from, to) =>
      admin.from('user_gps_tracking_prefs').select('user_id, updated_at').range(from, to)
    ),
    fetchAllSupabaseRows<{
      user_id: string
      instagram_handle: string
      status: string
      approved_at: string | null
      expires_at: string | null
      manually_unlocked: boolean
      manual_unlock_verified_mismatch: boolean
      created_at: string
    }>((from, to) =>
      admin
        .from('instagram_follow_bonus')
        .select(
          'user_id, instagram_handle, status, approved_at, expires_at, manually_unlocked, manual_unlock_verified_mismatch, created_at'
        )
        .in('status', ['approved', 'pending'])
        .range(from, to)
    ),
  ])

  const termsByUser = new Map<string, string>()
  for (const row of termsRows ?? []) {
    if (row.user_id && row.agreed_at) termsByUser.set(row.user_id, row.agreed_at)
  }

  const purchaseValidByUser = new Set<string>()
  const latestPurchaseByUser = new Map<string, { verified_at: string; expires_at: Date }>()
  const ordersByUser = new Map<
    string,
    {
      order_number: string
      used_at?: string | null
      created_at?: string | null
      expires_at?: string | null
    }[]
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

  return authUsers.map(user => {
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
        !!instagramPending &&
        !instagramPending.manually_unlocked &&
        !instagramPending.manual_unlock_verified_mismatch,
      instagram_can_mismatch_reapprove:
        !!instagramPending &&
        !instagramPending.manually_unlocked &&
        instagramPending.manual_unlock_verified_mismatch === true,
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
}

export function filterAdminPlayersListRows(
  players: AdminPlayerListRow[],
  filters: AdminPlayersListFilters
): AdminPlayerListRow[] {
  let filtered = players
  if (filters.instagramFollowOnly) {
    filtered = filtered.filter(player => player.instagram_follow_verified)
  }
  if (filters.instagramBonusActiveOnly) {
    filtered = filtered.filter(player => player.instagram_bonus_active)
  }
  if (filters.instagramManualMismatchOnly) {
    filtered = filtered.filter(player => player.instagram_manual_unlock_mismatch)
  }
  return filtered
}

export function sortAdminPlayersListRows(
  players: AdminPlayerListRow[],
  sort: AdminPlayersListSortKey,
  dir: 'asc' | 'desc'
): AdminPlayerListRow[] {
  const sorted = [...players]
  sorted.sort((a, b) => {
    let cmp = 0
    if (sort === 'instagram_manual_approve') {
      cmp = instagramManualApproveSortRank(a) - instagramManualApproveSortRank(b)
    } else if (sort === 'instagram_manual_unlock_mismatch') {
      cmp =
        (a.instagram_manual_unlock_mismatch ? 0 : 1) - (b.instagram_manual_unlock_mismatch ? 0 : 1)
    } else {
      const av = a[sort]
      const bv = b[sort]
      if (av == null && bv == null) cmp = 0
      else if (av == null) cmp = 1
      else if (bv == null) cmp = -1
      else if (typeof av === 'boolean' && typeof bv === 'boolean') {
        cmp = (av ? 1 : 0) - (bv ? 1 : 0)
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv), 'ko')
      }
    }
    return dir === 'asc' ? cmp : -cmp
  })
  return sorted
}

export function buildAdminPlayersListSummary(
  filteredPlayers: AdminPlayerListRow[],
  allSignups: number
) {
  return {
    total_signups: filteredPlayers.length,
    all_signups: allSignups,
    terms_agreed: filteredPlayers.filter(player => player.terms_agreed).length,
    purchase_verified: filteredPlayers.filter(player => player.purchase_verified).length,
    gps_users: filteredPlayers.filter(player => player.gps_record).length,
    instagram_follow_verified: filteredPlayers.filter(player => player.instagram_follow_verified)
      .length,
    instagram_bonus_active: filteredPlayers.filter(player => player.instagram_bonus_active).length,
    instagram_manual_mismatch: filteredPlayers.filter(
      player => player.instagram_manual_unlock_mismatch
    ).length,
  }
}

export function paginateAdminPlayersListRows(
  players: AdminPlayerListRow[],
  page: number,
  pageSize: number
): {
  players: AdminPlayerListRow[]
  pagination: { page: number; page_size: number; total: number; total_pages: number }
} {
  const total = players.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    players: players.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    },
  }
}
