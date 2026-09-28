import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { listAllAuthUsers } from '@/lib/admin-auth-users'
import { invalidateAdminPlayersListCache } from '@/lib/admin-players-list-cache'
import {
  chunk,
  loadFollowMatchContext,
  missingMatchRpcError,
  selectAllPages,
} from '@/lib/instagram-follow-approve-server'
import {
  buildFollowerHandleSet,
  planInstagramFollowMatch,
  type FollowApprovalPlanRow,
} from '@/lib/instagram-follow-match-plan'
import { loadVerificationSettings } from '@/lib/verification-settings'

const IN_FILTER_CHUNK = 150
const APPROVAL_RPC_CHUNK = 200

type FlaggedRow = {
  id: string
  user_id: string
  instagram_handle: string
  manually_unlocked: boolean
  created_at: string
  updated_at: string
}

export type FalseMismatchCandidate = {
  id: string
  user_id: string
  email: string | null
  instagram_handle: string
  claimed_at: string
  flagged_at: string
  /** 회수 시각 이전에 만든 푸시 구독이 지금도 남아 있음 → 불일치 푸시를 받았을 가능성이 높음 */
  mismatch_push_likely: boolean
  /** 같은 아이디가 이미 승인돼 있어 복구하지 않는 건 */
  handle_taken: boolean
}

export type FalseMismatchPreview = {
  flagged_total: number
  in_followers: number
  recoverable: number
  handle_taken: number
  push_likely_users: number
  candidates: FalseMismatchCandidate[]
}

type RecoveryPlan = {
  flaggedTotal: number
  inFollowers: FlaggedRow[]
  approvals: FollowApprovalPlanRow[]
}

/** pending + 불일치 표시인데 팔로워 목록(instagram_followers)에 아이디가 있는 행과 승인 계획 */
async function buildFalseMismatchRecoveryPlan(
  admin: SupabaseClient,
  now: Date,
  onlyIds?: Set<string>
): Promise<RecoveryPlan> {
  const [flagged, followers, settings] = await Promise.all([
    selectAllPages<FlaggedRow>((from, to) =>
      admin
        .from('instagram_follow_bonus')
        .select('id, user_id, instagram_handle, manually_unlocked, created_at, updated_at')
        .eq('status', 'pending')
        .eq('manual_unlock_verified_mismatch', true)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    selectAllPages<{ username: string }>((from, to) =>
      admin
        .from('instagram_followers')
        .select('username')
        .order('username', { ascending: true })
        .range(from, to)
    ),
    loadVerificationSettings(admin),
  ])

  const followerSet = buildFollowerHandleSet(followers.map(row => row.username))
  const inFollowers = flagged.filter(
    row =>
      followerSet.has(row.instagram_handle.trim().toLowerCase()) &&
      (!onlyIds || onlyIds.has(row.id))
  )

  const context = await loadFollowMatchContext(admin, inFollowers)
  const plan = planInstagramFollowMatch({
    pendingRows: inFollowers,
    handleSet: followerSet,
    ...context,
    bonusDays: settings.instagramFollowBonusDays,
    verifiedPeriodDays: settings.verifiedPeriodDays,
    now,
    sweepMismatches: false,
  })

  // 정정 알림 여부는 관리자가 따로 결정 — 복구 자체는 푸시를 적재하지 않음
  const approvals = plan.approvals.map(row => ({ ...row, notify: false }))
  return { flaggedTotal: flagged.length, inFollowers, approvals }
}

async function loadPushLikelyRowIds(
  admin: SupabaseClient,
  rows: FlaggedRow[]
): Promise<Set<string>> {
  const userIds = [...new Set(rows.map(row => row.user_id))]
  const subsByUser = new Map<string, (string | null)[]>()

  for (const ids of chunk(userIds, IN_FILTER_CHUNK)) {
    const subs = await selectAllPages<{ id: string; user_id: string; created_at: string | null }>(
      (from, to) =>
        admin
          .from('push_subscriptions')
          .select('id, user_id, created_at')
          .in('user_id', ids)
          .order('id', { ascending: true })
          .range(from, to)
    )
    for (const sub of subs) {
      const list = subsByUser.get(sub.user_id) ?? []
      list.push(sub.created_at)
      subsByUser.set(sub.user_id, list)
    }
  }

  const likely = new Set<string>()
  for (const row of rows) {
    const flaggedAt = new Date(row.updated_at).getTime()
    const subs = subsByUser.get(row.user_id) ?? []
    if (subs.some(createdAt => !createdAt || new Date(createdAt).getTime() <= flaggedAt)) {
      likely.add(row.id)
    }
  }
  return likely
}

export async function previewInstagramFalseMismatchRecovery(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<FalseMismatchPreview> {
  const plan = await buildFalseMismatchRecoveryPlan(admin, now)
  const recoverableIds = new Set(plan.approvals.map(row => row.id))

  const [pushLikely, users] = await Promise.all([
    loadPushLikelyRowIds(admin, plan.inFollowers),
    plan.inFollowers.length > 0 ? listAllAuthUsers(admin) : Promise.resolve([]),
  ])
  const emailById = new Map(users.map(user => [user.id, user.email ?? null]))

  const candidates: FalseMismatchCandidate[] = plan.inFollowers
    .map(row => ({
      id: row.id,
      user_id: row.user_id,
      email: emailById.get(row.user_id) ?? null,
      instagram_handle: row.instagram_handle,
      claimed_at: row.created_at,
      flagged_at: row.updated_at,
      mismatch_push_likely: pushLikely.has(row.id),
      handle_taken: !recoverableIds.has(row.id),
    }))
    .sort((a, b) => b.flagged_at.localeCompare(a.flagged_at))

  const pushLikelyUsers = new Set(
    candidates.filter(row => row.mismatch_push_likely).map(row => row.user_id)
  )

  return {
    flagged_total: plan.flaggedTotal,
    in_followers: plan.inFollowers.length,
    recoverable: recoverableIds.size,
    handle_taken: plan.inFollowers.length - recoverableIds.size,
    push_likely_users: pushLikelyUsers.size,
    candidates,
  }
}

/** 미리보기에서 확인한 id만 다시 검증해 승인 + 불일치 해제 (푸시 없음) */
export async function recoverInstagramFalseMismatches(
  admin: SupabaseClient,
  ids: string[],
  now: Date = new Date()
): Promise<{ requested: number; recovered: number; skipped: number }> {
  const requested = new Set(ids)
  const plan = await buildFalseMismatchRecoveryPlan(admin, now, requested)

  let recovered = 0
  for (const rows of chunk(plan.approvals, APPROVAL_RPC_CHUNK)) {
    const { data, error } = await admin.rpc('apply_instagram_follow_approvals', {
      p_job_id: null,
      p_rows: rows,
    })
    if (error) throw missingMatchRpcError(error)
    recovered += Array.isArray(data) ? data.length : 0
  }

  if (recovered > 0) invalidateAdminPlayersListCache()
  return { requested: requested.size, recovered, skipped: requested.size - recovered }
}
