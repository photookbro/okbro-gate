import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { requireTermsAgreement } from '@/lib/terms-agreement-server'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'
import {
  buildInstagramFollowBonusStatus,
  getEffectiveInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
} from '@/lib/instagram-follow-bonus'
import { instagramFollowSubmitCompleteMessage } from '@/lib/instagram-follow-copy'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  const admin = supabaseAdmin()
  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const now = new Date()

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

  const latestAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)
  if (
    latestAttempt?.status === 'pending' &&
    latestAttempt.instagram_handle === handle
  ) {
    const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
    const status = buildInstagramFollowBonusStatus(effectiveBonus, latestAttempt, bonusDays, now)
    return NextResponse.json({
      success: true,
      message: instagramFollowSubmitCompleteMessage(),
      status,
    })
  }

  const nowIso = now.toISOString()
  const { error: insertError } = await admin.from('instagram_follow_bonus').insert({
    user_id: user.id,
    instagram_handle: handle,
    status: 'pending',
    updated_at: nowIso,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: '이미 사용된 계정입니다' }, { status: 400 })
    }
    console.error('[instagram-follow/claim]', insertError)
    return NextResponse.json({ error: '신청 저장에 실패했어요' }, { status: 500 })
  }

  const effectiveBonus = await getEffectiveInstagramFollowBonus(admin, user.id, now)
  const updatedAttempt = await getLatestInstagramFollowBonusAttempt(admin, user.id)
  const status = buildInstagramFollowBonusStatus(effectiveBonus, updatedAttempt, bonusDays, now)

  return NextResponse.json({
    success: true,
    message: instagramFollowSubmitCompleteMessage(),
    status,
  })
}
