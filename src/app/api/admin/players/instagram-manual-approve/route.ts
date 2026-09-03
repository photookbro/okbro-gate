import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  manuallyUnlockInstagramFollowPendingRow,
  sendInstagramFollowApprovedPush,
} from '@/lib/instagram-follow-approve-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { loadVerificationSettings } from '@/lib/verification-settings'

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문을 읽지 못했어요' }, { status: 400 })
  }

  const userId = body.user_id?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: pendingRow, error: pendingError } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle, manually_unlocked')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingError) {
    console.error('[admin/players/instagram-manual-approve] pending lookup', pendingError)
    return NextResponse.json({ error: '인스타 신청 조회 실패' }, { status: 500 })
  }

  if (!pendingRow) {
    return NextResponse.json({ error: '대기 중인 인스타 팔로우 신청이 없어요' }, { status: 404 })
  }

  if (pendingRow.manually_unlocked) {
    return NextResponse.json({ error: '이미 수동 승인된 신청이에요' }, { status: 409 })
  }

  const settings = await loadVerificationSettings(admin)
  const bonusDays = settings.instagramFollowBonusDays
  const verifiedPeriodDays = settings.verifiedPeriodDays

  let unlocked
  try {
    unlocked = await manuallyUnlockInstagramFollowPendingRow(
      admin,
      pendingRow,
      bonusDays,
      verifiedPeriodDays
    )
  } catch (error) {
    console.error('[admin/players/instagram-manual-approve] unlock', error)
    return NextResponse.json({ error: '수동 승인 처리 실패' }, { status: 500 })
  }

  if (!unlocked) {
    return NextResponse.json(
      { error: '수동 승인할 수 없어요 (이미 승인된 아이디일 수 있어요)' },
      { status: 409 }
    )
  }

  const push = await sendInstagramFollowApprovedPush(userId, bonusDays)

  return NextResponse.json({
    success: true,
    instagram_handle: unlocked.instagram_handle,
    expires_at: unlocked.expires_at,
    push_sent: push.sent,
    push_failed: push.failed,
    no_subscription: push.no_subscription,
  })
}
