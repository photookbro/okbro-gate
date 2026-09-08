import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { requireTermsAgreement } from '@/lib/terms-agreement-server'
import { normalizeInstagramHandle, isBrandOwnInstagramHandle } from '@/lib/instagram-handle'
import {
  buildInstagramFollowBonusStatus,
  getEffectiveInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
  type InstagramFollowBonusRow,
} from '@/lib/instagram-follow-bonus'
import { manuallyUnlockInstagramFollowPendingRow } from '@/lib/instagram-follow-approve-server'
import { isInstagramHandleInBonusHistory } from '@/lib/instagram-handle-bonus-history'
import {
  instagramFollowSubmitCompleteMessage,
  instagramOwnAccountClaimBlockedMessage,
} from '@/lib/instagram-follow-copy'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function unlockPendingClaim(
  admin: ReturnType<typeof supabaseAdmin>,
  row: Pick<InstagramFollowBonusRow, 'id' | 'user_id' | 'instagram_handle'>,
  bonusDays: number,
  verifiedPeriodDays: number,
  now: Date
): Promise<InstagramFollowBonusRow | null> {
  return manuallyUnlockInstagramFollowPendingRow(
    admin,
    row,
    bonusDays,
    verifiedPeriodDays,
    now
  )
}

function claimSuccessResponse(
  status: ReturnType<typeof buildInstagramFollowBonusStatus>,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({
    success: true,
    message: instagramFollowSubmitCompleteMessage(),
    status,
    ...extra,
  })
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  const user = await requireTermsAgreement(authUser)
  if (user instanceof NextResponse) return user

  const body = await req.json().catch(() => ({}))
  const handle = normalizeInstagramHandle(
    typeof body.instagram_handle === 'string' ? body.instagram_handle : ''
  )

  if (!handle) {
    return NextResponse.json({ error: '인스타 아이디를 올바르게 입력해주세요' }, { status: 400 })
  }

  if (isBrandOwnInstagramHandle(handle)) {
    return NextResponse.json(
      { error: instagramOwnAccountClaimBlockedMessage() },
      { status: 400 }
    )
  }

  const admin = supabaseAdmin()
  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays
  const now = new Date()
  const nowIso = now.toISOString()

  await ensureUserProfile(admin, user.id, user.created_at ?? now.toISOString())

  const { data: handleTaken } = await admin
    .from('instagram_follow_bonus')
    .select('user_id')
    .eq('instagram_handle', handle)
    .eq('status', 'approved')
    .maybeSingle()

  if (handleTaken) {
    if (handleTaken.user_id === user.id) {
      return NextResponse.json(
        { error: '이미 등록한 인스타 아이디예요' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
  }

  // HTML 대조로 이미 확정된 핸들 → 자동승인(manual unlock) 보류, pending만 저장
  const handleAlreadyConsumed = await isInstagramHandleInBonusHistory(admin, handle)

  const latestAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)

  // pending 중 재제출: 같은 레코드만 갱신(중복 insert 금지)
  if (latestAttempt?.status === 'pending') {
    if (latestAttempt.instagram_handle === handle) {
      let attemptRow = latestAttempt
      if (!latestAttempt.manually_unlocked && !handleAlreadyConsumed) {
        const unlocked = await unlockPendingClaim(
          admin,
          latestAttempt,
          bonusDays,
          verifiedPeriodDays,
          now
        )
        if (!unlocked) {
          return NextResponse.json(
            { error: '이미 사용된 계정입니다' },
            { status: 400 }
          )
        }
        attemptRow = unlocked
      }

      const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
      const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)
      return claimSuccessResponse(status)
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
      if (updateError.code === '23505') {
        return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
      }
      console.error('[instagram-follow/claim] update pending', updateError)
      return NextResponse.json({ error: '신청 수정에 실패했어요' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: '신청을 수정할 수 없어요' }, { status: 409 })
    }

    let attemptRow = updated as InstagramFollowBonusRow
    if (!handleAlreadyConsumed) {
      const unlocked = await unlockPendingClaim(
        admin,
        attemptRow,
        bonusDays,
        verifiedPeriodDays,
        now
      )
      if (!unlocked) {
        return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
      }
      attemptRow = unlocked
    }

    const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
    const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)
    return claimSuccessResponse(status, { updated: true })
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
    if (insertError.code === '23505') {
      return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
    }
    console.error('[instagram-follow/claim]', insertError)
    return NextResponse.json({ error: '신청 저장에 실패했어요' }, { status: 500 })
  }

  if (!inserted) {
    return NextResponse.json({ error: '신청 저장에 실패했어요' }, { status: 500 })
  }

  let attemptRow = inserted as InstagramFollowBonusRow
  if (!handleAlreadyConsumed) {
    const unlocked = await unlockPendingClaim(
      admin,
      attemptRow,
      bonusDays,
      verifiedPeriodDays,
      now
    )
    if (!unlocked) {
      return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
    }
    attemptRow = unlocked
  }

  const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
  const status = buildInstagramFollowBonusStatus(effectiveBonus, attemptRow, bonusDays, now)

  return claimSuccessResponse(status)
}
