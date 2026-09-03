import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInstagramBonusClaimExpiresAt,
  getActiveInstagramBonusExpiresAt,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import {
  instagramFollowApprovedPushBody,
  instagramFollowMismatchPushBody,
} from '@/lib/instagram-follow-copy'
import { latestActiveExpiresAt, resolveExpiresAt } from '@/lib/order-verification'
import { sendPushToUser } from '@/lib/web-push-server'
import { loadVerificationSettings } from '@/lib/verification-settings'

export type InstagramMatchResult = {
  approved: number
  push_sent: number
  push_failed: number
  no_subscription: number
  manual_unlock_mismatches: number
  mismatch_push_sent: number
  mismatch_push_failed: number
  mismatch_no_subscription: number
}

const EMPTY_MATCH_RESULT: InstagramMatchResult = {
  approved: 0,
  push_sent: 0,
  push_failed: 0,
  no_subscription: 0,
  manual_unlock_mismatches: 0,
  mismatch_push_sent: 0,
  mismatch_push_failed: 0,
  mismatch_no_subscription: 0,
}

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
  return (approved as InstagramFollowBonusRow | null) ?? null
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

async function flagManualUnlockMismatchesAfterFollowerUpload(
  admin: SupabaseClient,
  handleSet: Set<string>,
  now: Date = new Date()
): Promise<MismatchRevokeResult> {
  const { data: manualPendingRows, error } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle')
    .eq('status', 'pending')
    .eq('manually_unlocked', true)

  if (error) throw error

  const nowIso = now.toISOString()
  const result: MismatchRevokeResult = {
    revoked: 0,
    push_sent: 0,
    push_failed: 0,
    no_subscription: 0,
  }

  for (const row of manualPendingRows ?? []) {
    const handle = row.instagram_handle.trim().toLowerCase()
    if (!handle || handleSet.has(handle)) continue

    const push = await revokeManualUnlockAndNotifyMismatch(admin, row, nowIso)
    result.revoked++
    result.push_sent += push.push_sent
    result.push_failed += push.push_failed
    result.no_subscription += push.no_subscription
  }

  return result
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

export async function matchPendingInstagramFollowClaims(
  admin: SupabaseClient,
  usernames: string[]
): Promise<InstagramMatchResult> {
  const handleSet = new Set(usernames.map(u => u.trim().toLowerCase()).filter(Boolean))
  if (handleSet.size === 0) {
    return { ...EMPTY_MATCH_RESULT }
  }

  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays

  const { data: pendingRows, error } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle, manually_unlocked')
    .eq('status', 'pending')

  if (error) throw error

  const toApprove = (pendingRows ?? []).filter(row =>
    handleSet.has(row.instagram_handle.trim().toLowerCase())
  )

  let approved = 0
  let pushSent = 0
  let pushFailed = 0
  let noSubscription = 0
  const notifiedUsers = new Set<string>()

  for (const row of toApprove) {
    const result = await approveInstagramFollowPendingRow(
      admin,
      row,
      bonusDays,
      verifiedPeriodDays
    )
    if (!result) continue

    approved++

    if (row.manually_unlocked) continue

    if (notifiedUsers.has(row.user_id)) continue
    notifiedUsers.add(row.user_id)

    const push = await sendInstagramFollowApprovedPush(row.user_id, bonusDays)
    if (push.sent > 0) {
      pushSent += push.sent
    } else if (push.failed > 0) {
      pushFailed += push.failed
    } else if (push.no_subscription) {
      noSubscription++
    }
  }

  const mismatchRevoke = await flagManualUnlockMismatchesAfterFollowerUpload(admin, handleSet)

  return {
    approved,
    push_sent: pushSent,
    push_failed: pushFailed,
    no_subscription: noSubscription,
    manual_unlock_mismatches: mismatchRevoke.revoked,
    mismatch_push_sent: mismatchRevoke.push_sent,
    mismatch_push_failed: mismatchRevoke.push_failed,
    mismatch_no_subscription: mismatchRevoke.no_subscription,
  }
}
