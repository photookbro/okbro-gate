import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'
import {
  buildInstagramFollowBonusStatus,
  calculateInstagramBonusExpiresAt,
  getApprovedInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
} from '@/lib/instagram-follow-bonus'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase'

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

  const profile = await ensureUserProfile(admin, user.id, user.created_at ?? new Date().toISOString())

  const existingApproved = await getApprovedInstagramFollowBonus(admin, user.id)
  if (existingApproved) {
    const status = buildInstagramFollowBonusStatus(
      existingApproved,
      existingApproved,
      bonusDays
    )
    return NextResponse.json(
      {
        error:
          status.state === 'active'
            ? '이미 혜택이 적용 중이에요'
            : '이미 사용된 계정입니다',
        status,
      },
      { status: 400 }
    )
  }

  const { data: handleTaken } = await admin
    .from('instagram_follow_bonus')
    .select('user_id')
    .eq('instagram_handle', handle)
    .eq('status', 'approved')
    .maybeSingle()

  if (handleTaken && handleTaken.user_id !== user.id) {
    return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
  }

  const { data: follower } = await admin
    .from('instagram_followers')
    .select('username')
    .eq('username', handle)
    .maybeSingle()

  const nowIso = new Date().toISOString()

  if (!follower) {
    await admin.from('instagram_follow_bonus').insert({
      user_id: user.id,
      instagram_handle: handle,
      status: 'rejected',
      updated_at: nowIso,
    })

    const latestAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)
    const status = buildInstagramFollowBonusStatus(null, latestAttempt, bonusDays)

    return NextResponse.json(
      {
        error:
          '아직 팔로워 목록에서 확인되지 않았어요. 매주 금요일 업데이트되니 그 이후 다시 시도해주세요.',
        status,
      },
      { status: 400 }
    )
  }

  const expiresAt = calculateInstagramBonusExpiresAt(profile.first_created_at, bonusDays)

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

  const approved = await getApprovedInstagramFollowBonus(admin, user.id)
  const status = buildInstagramFollowBonusStatus(approved, approved, bonusDays)

  return NextResponse.json({
    success: true,
    message: '인스타 팔로우 혜택이 적용됐어요',
    status,
  })
}
