import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import {
  buildInstagramFollowBonusStatus,
  getEffectiveInstagramFollowBonus,
  getLatestInstagramFollowBonusAttempt,
} from '@/lib/instagram-follow-bonus'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { loadVerificationSettings } from '@/lib/verification-settings'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
    }

    const admin = supabaseAdmin()
    const settings = await loadVerificationSettings(admin)

    await ensureUserProfile(admin, user.id, user.created_at ?? new Date().toISOString())

    const [effectiveBonus, latestAttempt] = await Promise.all([
      getEffectiveInstagramFollowBonus(admin, user.id),
      getLatestInstagramFollowBonusAttempt(admin, user.id),
    ])

    const status = buildInstagramFollowBonusStatus(
      effectiveBonus,
      latestAttempt,
      settings.instagramFollowBonusDays
    )

    return NextResponse.json(status)
  } catch (error) {
    console.error('[instagram-follow/status]', error)
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string' &&
      (error as { message: string }).message.includes('profiles')
        ? 'profiles / instagram_follow_bonus 테이블이 없어요. Supabase에서 20260727 마이그레이션을 실행해주세요.'
        : '상태를 불러오지 못했어요'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
