import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInstagramBonusClaimExpiresAt,
  getActiveInstagramBonusExpiresAt,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import {
  instagramFollowApprovedPushBody,
  instagramFollowMismatchPushBody,
} from '@/lib/instagram-follow-copy'
import {
  buildFollowerHandleSet,
  pickLatestOrder,
  planInstagramFollowMatch,
  type PendingFollowClaim,
  type UserInstagramBonusRow,
} from '@/lib/instagram-follow-match-plan'
import { recordInstagramHandleBonusHistory } from '@/lib/instagram-handle-bonus-history'
import {
  latestActiveExpiresAt,
  resolveExpiresAt,
  type OrderRecord,
} from '@/lib/order-verification'
import { sendPushToUser } from '@/lib/web-push-server'
import { loadVerificationSettings } from '@/lib/verification-settings'

export type InstagramMatchResult = {
  approved: number
  manual_unlock_mismatches: number
  skipped_handle_taken: number
}

const IN_FILTER_CHUNK = 150
const APPROVAL_RPC_CHUNK = 200
const MISMATCH_RPC_CHUNK = 500

type InstagramUnlockFields = {
  approved_at: string
  bonus_days_granted: number
  expires_at: string
}

async function calculateInstagramFollowUnlockFields(
  admin: SupabaseClient,
  userId: string,
  bonusDays: number,
  verifiedPeriodDays: number,
  now: Date = new Date()
): Promise<InstagramUnlockFields> {
  const previousInstagramExpires = await getActiveInstagramBonusExpiresAt(admin, userId, now)

  let purchaseExpires: Date | null = null
  const { data: latestOrder } = await admin
    .from('orders')
    .select('order_number, used_at, created_at, expires_at')
    .eq('user_id', userId)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestOrder) {
    purchaseExpires = resolveExpiresAt(latestOrder, verifiedPeriodDays)
  }

  const previousActiveExpires = latestActiveExpiresAt(
    [previousInstagramExpires, purchaseExpires],
    now
  )
  const expiresAt = calculateInstagramBonusClaimExpiresAt(
    previousActiveExpires,
    bonusDays,
    now
  )
  const nowIso = now.toISOString()

  return {
    approved_at: nowIso,
    bonus_days_granted: bonusDays,
    expires_at: expiresAt.toISOString(),
  }
}

export async function approveInstagramFollowPendingRow(
  admin: SupabaseClient,
  row: Pick<InstagramFollowBonusRow, 'id' | 'user_id' | 'instagram_handle'>,
  bonusDays: number,
  verifiedPeriodDays: number,
  now: Date = new Date()
): Promise<InstagramFollowBonusRow | null> {
  const handle = row.instagram_handle.trim()
  if (!handle) return null

  const { data: handleTaken } = await admin
    .from('instagram_follow_bonus')
    .select('user_id')
    .eq('instagram_handle', handle)
    .eq('status', 'approved')
    .maybeSingle()

  if (handleTaken && handleTaken.user_id !== row.user_id) {
    return null
  }

  const unlockFields = await calculateInstagramFollowUnlockFields(
    admin,
    row.user_id,
    bonusDays,
    verifiedPeriodDays,
    now
  )
  const nowIso = now.toISOString()

  const { data: approved, error } = await admin
    .from('instagram_follow_bonus')
    .update({
      status: 'approved',
      approved_at: unlockFields.approved_at,
      bonus_days_granted: unlockFields.bonus_days_granted,
      expires_at: unlockFields.expires_at,
      manually_unlocked: false,
      manual_unlock_verified_mismatch: false,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!approved) return null

  try {
    await recordInstagramHandleBonusHistory(
      admin,
      approved.instagram_handle,
      approved.user_id,
      now
    )
  } catch (historyError) {
    // 승인은 이미 반영됨 — 이력 실패만 로그 (다음 업로드 재기록 가능)
    console.error('[instagram] record handle bonus history failed', historyError)
  }

  return approved as InstagramFollowBonusRow
}

export async function manuallyUnlockInstagramFollowPendingRow(
  admin: SupabaseClient,
  row: Pick<InstagramFollowBonusRow, 'id' | 'user_id' | 'instagram_handle'>,
  bonusDays: number,
  verifiedPeriodDays: number,
  now: Date = new Date()
): Promise<InstagramFollowBonusRow | null> {
  const handle = row.instagram_handle.trim()
  if (!handle) return null

  const { data: handleTaken } = await admin
    .from('instagram_follow_bonus')
    .select('user_id')
    .eq('instagram_handle', handle)
    .eq('status', 'approved')
    .maybeSingle()

  if (handleTaken && handleTaken.user_id !== row.user_id) {
    return null
  }

  const unlockFields = await calculateInstagramFollowUnlockFields(
    admin,
    row.user_id,
    bonusDays,
    verifiedPeriodDays,
    now
  )
  const nowIso = now.toISOString()

  const { data: unlocked, error } = await admin
    .from('instagram_follow_bonus')
    .update({
      status: 'pending',
      approved_at: unlockFields.approved_at,
      bonus_days_granted: unlockFields.bonus_days_granted,
      expires_at: unlockFields.expires_at,
      manually_unlocked: true,
      manual_unlock_verified_mismatch: false,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (error) throw error
  return (unlocked as InstagramFollowBonusRow | null) ?? null
}

const PENDING_AUTO_UNLOCK_PAGE_SIZE = 100

/**
 * pending + 아직 수동해제 안 된 건을 일괄 해제(제출 즉시 승인 정책 소급).
 * 불일치(manual_unlock_verified_mismatch) 표시 건은 건드리지 않음.
 */
export async function backfillPendingInstagramManualUnlocks(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ unlocked: number; skipped: number; failed: number }> {
  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays

  let unlocked = 0
  let skipped = 0
  let failed = 0
  let from = 0

  for (;;) {
    const { data, error } = await admin
      .from('instagram_follow_bonus')
      .select('id, user_id, instagram_handle, manually_unlocked, manual_unlock_verified_mismatch')
      .eq('status', 'pending')
      .eq('manually_unlocked', false)
      .eq('manual_unlock_verified_mismatch', false)
      .order('created_at', { ascending: true })
      .range(from, from + PENDING_AUTO_UNLOCK_PAGE_SIZE - 1)

    if (error) throw error

    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      try {
        const result = await manuallyUnlockInstagramFollowPendingRow(
          admin,
          row,
          bonusDays,
          verifiedPeriodDays,
          now
        )
        if (result) unlocked++
        else skipped++
      } catch (err) {
        failed++
        console.error('[instagram] backfill pending unlock failed', {
          id: row.id,
          userId: row.user_id,
          error: err,
        })
      }
    }

    if (rows.length < PENDING_AUTO_UNLOCK_PAGE_SIZE) break
    // 앞 페이지를 unlock하면 manually_unlocked=false 집합이 줄어 range(from+=page)는 건너뜀
    // → 항상 from=0으로 남은 locked pending만 재조회
    from = 0
  }

  return { unlocked, skipped, failed }
}

export async function sendInstagramFollowApprovedPush(
  userId: string,
  bonusDays: number
): Promise<{ sent: number; failed: number; no_subscription: boolean }> {
  const push = await sendPushToUser(userId, {
    title: 'OKbroGATE',
    body: instagramFollowApprovedPushBody(bonusDays),
    url: '/mypage',
  })

  return {
    sent: push.sent,
    failed: push.failed,
    no_subscription: push.sent === 0 && push.failed === 0,
  }
}

export async function sendInstagramFollowMismatchPush(
  userId: string
): Promise<{ sent: number; failed: number; no_subscription: boolean }> {
  const push = await sendPushToUser(userId, {
    title: 'OKbroGATE',
    body: instagramFollowMismatchPushBody(),
    url: '/instagram-follow',
  })

  return {
    sent: push.sent,
    failed: push.failed,
    no_subscription: push.sent === 0 && push.failed === 0,
  }
}

type MismatchRevokeResult = {
  revoked: number
  push_sent: number
  push_failed: number
  no_subscription: number
}

async function revokeManualUnlockAndNotifyMismatch(
  admin: SupabaseClient,
  row: { id: string; user_id: string },
  nowIso: string
): Promise<{ push_sent: number; push_failed: number; no_subscription: number }> {
  const { error: updateError } = await admin
    .from('instagram_follow_bonus')
    .update({
      manually_unlocked: false,
      manual_unlock_verified_mismatch: true,
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .eq('manually_unlocked', true)

  if (updateError) throw updateError

  const push = await sendInstagramFollowMismatchPush(row.user_id)
  if (push.sent > 0) return { push_sent: push.sent, push_failed: 0, no_subscription: 0 }
  if (push.failed > 0) return { push_sent: 0, push_failed: push.failed, no_subscription: 0 }
  return { push_sent: 0, push_failed: 0, no_subscription: push.no_subscription ? 1 : 0 }
}

/** 불일치/오입력 회수 — pending + manually_unlocked 건에만 적용 */
export async function revokeInstagramManualUnlockAsMismatch(
  admin: SupabaseClient,
  row: { id: string; user_id: string },
  now: Date = new Date()
): Promise<{ push_sent: number; push_failed: number; no_subscription: number }> {
  return revokeManualUnlockAndNotifyMismatch(admin, row, now.toISOString())
}

/** 이미 불일치로 표시됐지만 수동 해제가 남아 있는 건을 회수하고 푸시 */
export async function revokeExistingMismatchedManualUnlocks(
  admin: SupabaseClient,
  options: { excludeUserIds?: Set<string> } = {},
  now: Date = new Date()
): Promise<MismatchRevokeResult> {
  const { data: rows, error } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle')
    .eq('status', 'pending')
    .eq('manually_unlocked', true)
    .eq('manual_unlock_verified_mismatch', true)

  if (error) throw error

  const nowIso = now.toISOString()
  const exclude = options.excludeUserIds ?? new Set<string>()
  const result: MismatchRevokeResult = {
    revoked: 0,
    push_sent: 0,
    push_failed: 0,
    no_subscription: 0,
  }

  for (const row of rows ?? []) {
    if (exclude.has(row.user_id)) continue
    const push = await revokeManualUnlockAndNotifyMismatch(admin, row, nowIso)
    result.revoked++
    result.push_sent += push.push_sent
    result.push_failed += push.push_failed
    result.no_subscription += push.no_subscription
  }

  return result
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** PostgREST max_rows(기본 1000)에 잘리지 않도록 빈 페이지가 나올 때까지 range 조회 */
export async function selectAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    if (page.length === 0) return rows
    rows.push(...page)
  }
}

export function missingMatchRpcError(error: PostgrestError): Error {
  if (error.code === 'PGRST202' || error.code === '42883') {
    return new Error(
      '대조 함수가 없어요. Supabase SQL Editor에서 마이그레이션 20260928_instagram_follower_upload_match_outbox.sql 을 실행해주세요.'
    )
  }
  return new Error(`대조 반영 실패: ${error.message}`)
}

export type FollowMatchContext = {
  approvedHandles: Set<string>
  userBonusRows: UserInstagramBonusRow[]
  latestOrderByUser: Map<string, OrderRecord>
}

/** 승인 대상 행들의 만료일 계산에 필요한 기존 승인 아이디·유저 혜택·주문을 청크 조회 */
export async function loadFollowMatchContext(
  admin: SupabaseClient,
  matchedRows: Pick<PendingFollowClaim, 'user_id' | 'instagram_handle'>[]
): Promise<FollowMatchContext> {
  const matchedHandles = [...new Set(matchedRows.map(row => row.instagram_handle.trim()))]
  const matchedUserIds = [...new Set(matchedRows.map(row => row.user_id))]

  const approvedHandles = new Set<string>()
  for (const handles of chunk(matchedHandles, IN_FILTER_CHUNK)) {
    const { data, error } = await admin
      .from('instagram_follow_bonus')
      .select('instagram_handle')
      .eq('status', 'approved')
      .in('instagram_handle', handles)
    if (error) throw error
    for (const row of data ?? []) approvedHandles.add(row.instagram_handle)
  }

  const userBonusRows: UserInstagramBonusRow[] = []
  const ordersByUser = new Map<string, OrderRecord[]>()
  for (const userIds of chunk(matchedUserIds, IN_FILTER_CHUNK)) {
    const [bonusRows, orders] = await Promise.all([
      selectAllPages<UserInstagramBonusRow>((from, to) =>
        admin
          .from('instagram_follow_bonus')
          .select('id, user_id, status, expires_at, manually_unlocked')
          .in('user_id', userIds)
          .or('status.eq.approved,and(status.eq.pending,manually_unlocked.eq.true)')
          .order('id', { ascending: true })
          .range(from, to)
      ),
      selectAllPages<OrderRecord & { user_id: string }>((from, to) =>
        admin
          .from('orders')
          .select('user_id, order_number, used_at, created_at, expires_at')
          .in('user_id', userIds)
          .order('id', { ascending: true })
          .range(from, to)
      ),
    ])
    userBonusRows.push(...bonusRows)
    for (const order of orders) {
      const list = ordersByUser.get(order.user_id) ?? []
      list.push(order)
      ordersByUser.set(order.user_id, list)
    }
  }

  const latestOrderByUser = new Map<string, OrderRecord>()
  for (const [userId, orders] of ordersByUser) {
    const latest = pickLatestOrder(orders)
    if (latest) latestOrderByUser.set(userId, latest)
  }

  return { approvedHandles, userBonusRows, latestOrderByUser }
}

/**
 * 팔로워 목록과 pending 신청 대조 — 조회는 청크 단위, 반영은 RPC 일괄 update.
 * 푸시는 여기서 보내지 않고 instagram_follow_push_outbox 에 적재만 함.
 * sweepMismatches=false(부분 목록)면 승인 매칭만 하고 불일치 회수는 하지 않음.
 */
export async function matchPendingInstagramFollowClaims(
  admin: SupabaseClient,
  usernames: string[],
  options: {
    jobId: string
    sweepMismatches: boolean
    onProgress?: () => Promise<void>
    now?: Date
  }
): Promise<InstagramMatchResult> {
  const result: InstagramMatchResult = {
    approved: 0,
    manual_unlock_mismatches: 0,
    skipped_handle_taken: 0,
  }

  const handleSet = buildFollowerHandleSet(usernames)
  if (handleSet.size === 0) return result

  const now = options.now ?? new Date()
  const settings = await loadVerificationSettings(admin)

  const pendingRows = await selectAllPages<PendingFollowClaim>((from, to) =>
    admin
      .from('instagram_follow_bonus')
      .select('id, user_id, instagram_handle, manually_unlocked, created_at')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .range(from, to)
  )

  const matchedRows = pendingRows.filter(row =>
    handleSet.has(row.instagram_handle.trim().toLowerCase())
  )
  const context = await loadFollowMatchContext(admin, matchedRows)

  const plan = planInstagramFollowMatch({
    pendingRows,
    handleSet,
    ...context,
    bonusDays: settings.instagramFollowBonusDays,
    verifiedPeriodDays: settings.verifiedPeriodDays,
    now,
    sweepMismatches: options.sweepMismatches,
  })
  result.skipped_handle_taken = plan.skippedHandleTaken

  await options.onProgress?.()

  for (const rows of chunk(plan.approvals, APPROVAL_RPC_CHUNK)) {
    const { data, error } = await admin.rpc('apply_instagram_follow_approvals', {
      p_job_id: options.jobId,
      p_rows: rows,
    })
    if (error) throw missingMatchRpcError(error)
    result.approved += Array.isArray(data) ? data.length : 0
    await options.onProgress?.()
  }

  for (const ids of chunk(plan.mismatchIds, MISMATCH_RPC_CHUNK)) {
    const { data, error } = await admin.rpc('apply_instagram_follow_mismatch_revokes', {
      p_job_id: options.jobId,
      p_ids: ids,
    })
    if (error) throw missingMatchRpcError(error)
    result.manual_unlock_mismatches += Array.isArray(data) ? data.length : 0
    await options.onProgress?.()
  }

  return result
}
