import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateInstagramBonusClaimExpiresAt,
  getActiveInstagramBonusExpiresAt,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import { instagramFollowApprovedPushBody } from '@/lib/instagram-follow-copy'
import { latestActiveExpiresAt, resolveExpiresAt } from '@/lib/order-verification'
import { sendPushToUser } from '@/lib/web-push-server'
import { loadVerificationSettings } from '@/lib/verification-settings'

export type InstagramMatchResult = {
  approved: number
  push_sent: number
  push_failed: number
  no_subscription: number
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

  const previousInstagramExpires = await getActiveInstagramBonusExpiresAt(admin, row.user_id, now)

  let purchaseExpires: Date | null = null
  const { data: latestOrder } = await admin
    .from('orders')
    .select('order_number, used_at, created_at, expires_at')
    .eq('user_id', row.user_id)
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

  const { data: approved, error } = await admin
    .from('instagram_follow_bonus')
    .update({
      status: 'approved',
      approved_at: nowIso,
      bonus_days_granted: bonusDays,
      expires_at: expiresAt.toISOString(),
      updated_at: nowIso,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (error) throw error
  return (approved as InstagramFollowBonusRow | null) ?? null
}

export async function matchPendingInstagramFollowClaims(
  admin: SupabaseClient,
  usernames: string[]
): Promise<InstagramMatchResult> {
  const handleSet = new Set(usernames.map(u => u.trim().toLowerCase()).filter(Boolean))
  if (handleSet.size === 0) {
    return { approved: 0, push_sent: 0, push_failed: 0, no_subscription: 0 }
  }

  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays

  const { data: pendingRows, error } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle')
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

    if (notifiedUsers.has(row.user_id)) continue
    notifiedUsers.add(row.user_id)

    const push = await sendPushToUser(row.user_id, {
      title: 'OKbroGATE',
      body: instagramFollowApprovedPushBody(bonusDays),
      url: '/mypage',
    })

    if (push.sent > 0) {
      pushSent += push.sent
    } else if (push.failed > 0) {
      pushFailed += push.failed
    } else {
      noSubscription++
    }
  }

  return { approved, push_sent: pushSent, push_failed: pushFailed, no_subscription: noSubscription }
}
