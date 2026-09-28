import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildInstagramFollowBonusStatus,
  getEffectiveInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import {
  approveInstagramFollowPendingRow,
  manuallyUnlockInstagramFollowPendingRow,
} from '@/lib/instagram-follow-approve-server'
import type { InstagramClaimAutoAction } from '@/lib/instagram-claim-auto-action'
import { resolveInstagramClaimAutoAction } from '@/lib/instagram-claim-auto-unlock-server'
import {
  instagramFollowAwaitingCheckNotice,
  instagramFollowSubmitCompleteMessage,
} from '@/lib/instagram-follow-copy'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'

export type InstagramFollowClaimResult = {
  httpStatus: number
  body: Record<string, unknown>
}

function claimError(httpStatus: number, error: string): InstagramFollowClaimResult {
  return { httpStatus, body: { error } }
}

const HANDLE_TAKEN_ERROR = '이미 사용된 계정입니다'

/** 제출 직후 처리 적용 — null이면 같은 아이디가 이미 다른 계정에 승인됨 */
async function applyClaimAutoAction(
  admin: SupabaseClient,
  row: InstagramFollowBonusRow,
  action: InstagramClaimAutoAction,
  bonusDays: number,
  verifiedPeriodDays: number,
  now: Date
): Promise<InstagramFollowBonusRow | null> {
  if (action === 'pending') return row
  const apply =
    action === 'approve' ? approveInstagramFollowPendingRow : manuallyUnlockInstagramFollowPendingRow
  return apply(admin, row, bonusDays, verifiedPeriodDays, now)
}

function claimSuccess(
  status: ReturnType<typeof buildInstagramFollowBonusStatus>,
  action: InstagramClaimAutoAction | null,
  extra?: Record<string, unknown>
): InstagramFollowClaimResult {
  return {
    httpStatus: 200,
    body: {
      success: true,
      message:
        action === 'pending'
          ? instagramFollowAwaitingCheckNotice()
          : instagramFollowSubmitCompleteMessage(),
      status,
      ...extra,
    },
  }
}

/** 정규화·본계정 검사를 마친 아이디 제출 처리 */
export async function submitInstagramFollowClaim(
  admin: SupabaseClient,
  user: { id: string; created_at?: string | null },
  handle: string,
  now: Date = new Date()
): Promise<InstagramFollowClaimResult> {
  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays
  const nowIso = now.toISOString()

  await ensureUserProfile(admin, user.id, user.created_at ?? nowIso)

  const { data: handleTaken } = await admin
    .from('instagram_follow_bonus')
    .select('user_id')
    .eq('instagram_handle', handle)
    .eq('status', 'approved')
    .maybeSingle()

  if (handleTaken) {
    if (handleTaken.user_id === user.id) {
      return claimError(400, '이미 등록한 인스타 아이디예요')
    }
    return claimError(400, HANDLE_TAKEN_ERROR)
  }

  // 확정 이력 아이디 → 대기만 / 회수 이력 계정 → 최신 팔로워 목록에 있을 때만 즉시 승인
  const autoAction = await resolveInstagramClaimAutoAction(admin, user.id, handle)

  const latestAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)

  // pending 중 재제출: 같은 레코드만 갱신(중복 insert 금지)
  if (latestAttempt?.status === 'pending') {
    if (latestAttempt.instagram_handle === handle) {
      let attemptRow = latestAttempt
      let appliedAction: InstagramClaimAutoAction | null = null
      if (!latestAttempt.manually_unlocked) {
        const applied = await applyClaimAutoAction(
          admin,
          latestAttempt,
          autoAction,
          bonusDays,
          verifiedPeriodDays,
          now
        )
        if (!applied) return claimError(400, HANDLE_TAKEN_ERROR)
        attemptRow = applied
        appliedAction = autoAction
      }

      const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
      const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)
      return claimSuccess(status, appliedAction)
    }

    const { data: updated, error: updateError } = await admin
      .from('instagram_follow_bonus')
      .update({
        instagram_handle: handle,
        status: 'pending',
        manually_unlocked: false,
        manual_unlock_verified_mismatch: false,
        approved_at: null,
        bonus_days_granted: null,
        expires_at: null,
        updated_at: nowIso,
      })
      .eq('id', latestAttempt.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()

    if (updateError) {
      if (updateError.code === '23505') return claimError(400, HANDLE_TAKEN_ERROR)
      console.error('[instagram-follow/claim] update pending', updateError)
      return claimError(500, '신청 수정에 실패했어요')
    }

    if (!updated) return claimError(409, '신청을 수정할 수 없어요')

    const attemptRow = await applyClaimAutoAction(
      admin,
      updated as InstagramFollowBonusRow,
      autoAction,
      bonusDays,
      verifiedPeriodDays,
      now
    )
    if (!attemptRow) return claimError(400, HANDLE_TAKEN_ERROR)

    const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
    const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)
    return claimSuccess(status, autoAction, { updated: true })
  }

  const { data: inserted, error: insertError } = await admin
    .from('instagram_follow_bonus')
    .insert({
      user_id: user.id,
      instagram_handle: handle,
      status: 'pending',
      updated_at: nowIso,
    })
    .select('*')
    .maybeSingle()

  if (insertError) {
    if (insertError.code === '23505') return claimError(400, HANDLE_TAKEN_ERROR)
    console.error('[instagram-follow/claim]', insertError)
    return claimError(500, '신청 저장에 실패했어요')
  }

  if (!inserted) return claimError(500, '신청 저장에 실패했어요')

  const attemptRow = await applyClaimAutoAction(
    admin,
    inserted as InstagramFollowBonusRow,
    autoAction,
    bonusDays,
    verifiedPeriodDays,
    now
  )
  if (!attemptRow) return claimError(400, HANDLE_TAKEN_ERROR)

  const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
  const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)
  return claimSuccess(status, autoAction)
}
