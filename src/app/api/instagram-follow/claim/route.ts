import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'
import {
  buildInstagramFollowBonusStatus,
  calculateInstagramBonusClaimExpiresAt,
  getActiveInstagramBonusExpiresAt,
  getApprovedInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
} from '@/lib/instagram-follow-bonus'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const handle = normalizeInstagramHandle(
    typeof body.instagram_handle === 'string' ? body.instagram_handle : ''
  )

  if (!handle) {
    return NextResponse.json({ error: '인스타 아이디를 올바르게 입력해주세요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays

  // profiles 행 보장 (관리/리셋용). 만료일 계산은 더 이상 가입일 기준이 아님.
  await ensureUserProfile(admin, user.id, user.created_at ?? new Date().toISOString())

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

  const { data: follower } = await admin
    .from('instagram_followers')
    .select('username')
    .eq('username', handle)
    .maybeSingle()

  const now = new Date()
  const nowIso = now.toISOString()

  if (!follower) {
    await admin.from('instagram_follow_bonus').insert({
      user_id: user.id,
      instagram_handle: handle,
      status: 'rejected',
      updated_at: nowIso,
    })

    const latestAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)
    const approved = await getApprovedInstagramFollowBonus(admin, user.id, now)
    const status = buildInstagramFollowBonusStatus(approved, latestAttempt, bonusDays, now)

    return NextResponse.json(
      {
        error:
          '아직 확인되지 않았어요. 매주 금요일 오후에 확인 후 반영되니, 그 이후 다시 시도해주세요.',
        status,
      },
      { status: 400 }
    )
  }

  const previousActiveExpires = await getActiveInstagramBonusExpiresAt(admin, user.id, now)
  const expiresAt = calculateInstagramBonusClaimExpiresAt(
    previousActiveExpires,
    bonusDays,
    now
  )

  const { error: insertError } = await admin.from('instagram_follow_bonus').insert({
    user_id: user.id,
    instagram_handle: handle,
    status: 'approved',
    approved_at: nowIso,
    bonus_days_granted: bonusDays,
    expires_at: expiresAt.toISOString(),
    updated_at: nowIso,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
    }
    console.error('[instagram-follow/claim]', insertError)
    return NextResponse.json({ error: '혜택 저장에 실패했어요' }, { status: 500 })
  }

  const approved = await getApprovedInstagramFollowBonus(admin, user.id, now)
  const status = buildInstagramFollowBonusStatus(approved, approved, bonusDays, now)

  return NextResponse.json({
    success: true,
    message: previousActiveExpires
      ? `인스타 팔로우 혜택이 ${bonusDays}일 연장됐어요`
      : `인스타 팔로우 혜택 ${bonusDays}일이 적용됐어요`,
    status,
  })
}
