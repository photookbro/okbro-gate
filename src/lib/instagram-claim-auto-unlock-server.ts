import type { SupabaseClient } from '@supabase/supabase-js'
import {
  decideInstagramClaimAutoAction,
  type InstagramClaimAutoAction,
} from '@/lib/instagram-claim-auto-action'
import { isInstagramHandleInBonusHistory } from '@/lib/instagram-handle-bonus-history'
import { getLatestInstagramFollowerSnapshotBaseline } from '@/lib/instagram-followers-upload-job-server'

/** 불일치·다른 계정 아이디로 자동승인이 회수된 적이 있는 계정인지 (profiles.instagram_auto_unlock_blocked_at) */
export async function isInstagramAutoUnlockBlocked(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('instagram_auto_unlock_blocked_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // 마이그레이션 20260928_instagram_resubmit_auto_unlock_block 이전: 기존 동작 유지
    if (error.code === '42703' || error.code === 'PGRST204') {
      console.error('[instagram claim] profiles.instagram_auto_unlock_blocked_at missing')
      return false
    }
    throw error
  }
  return !!data?.instagram_auto_unlock_blocked_at
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

/**
 * 저장된 팔로워 목록에 있는 아이디인지.
 * instagram_followers 는 언팔한 아이디도 남아 있어, 최신 전체 목록 업로드 이후 갱신된 행만 본다.
 */
export async function isHandleInCurrentFollowerList(
  admin: SupabaseClient,
  handle: string
): Promise<boolean> {
  const baseline = await getLatestInstagramFollowerSnapshotBaseline(admin)
  let query = admin
    .from('instagram_followers')
    .select('username')
    .ilike('username', escapeLikePattern(handle))
  if (baseline) query = query.gte('updated_at', baseline.created_at)

  const { data, error } = await query.limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

export async function resolveInstagramClaimAutoAction(
  admin: SupabaseClient,
  userId: string,
  handle: string
): Promise<InstagramClaimAutoAction> {
  const handleConsumed = await isInstagramHandleInBonusHistory(admin, handle)
  if (handleConsumed) {
    return decideInstagramClaimAutoAction({
      handleConsumed,
      autoUnlockBlocked: false,
      inCurrentFollowers: false,
    })
  }

  const autoUnlockBlocked = await isInstagramAutoUnlockBlocked(admin, userId)
  const inCurrentFollowers = autoUnlockBlocked
    ? await isHandleInCurrentFollowerList(admin, handle)
    : false
  return decideInstagramClaimAutoAction({ handleConsumed, autoUnlockBlocked, inCurrentFollowers })
}
