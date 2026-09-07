import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'

function normalizeHistoryHandle(handle: string): string | null {
  return normalizeInstagramHandle(handle)
}

/** HTML 대조로 확정된 적 있는 핸들인지 (탈퇴 후에도 유지) */
export async function isInstagramHandleInBonusHistory(
  admin: SupabaseClient,
  handle: string
): Promise<boolean> {
  const normalized = normalizeHistoryHandle(handle)
  if (!normalized) return false

  const { data, error } = await admin
    .from('instagram_handle_bonus_history')
    .select('instagram_handle')
    .eq('instagram_handle', normalized)
    .maybeSingle()

  if (error) {
    // 테이블 미적용 시 자동승인 구멍 방지: 이력 확인 실패 = 자동승인 보류
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      console.error(
        '[instagram_handle_bonus_history] table missing — fail closed (skip auto-unlock)'
      )
      return true
    }
    throw error
  }

  return !!data
}

/**
 * HTML 팔로워 대조로 status=approved 확정된 순간에만 호출.
 * 자동승인(manual unlock) / 불일치 회수에서는 호출하지 않음.
 */
export async function recordInstagramHandleBonusHistory(
  admin: SupabaseClient,
  handle: string,
  userId: string,
  confirmedAt: Date = new Date()
): Promise<void> {
  const normalized = normalizeHistoryHandle(handle)
  if (!normalized) return

  const confirmedIso = confirmedAt.toISOString()

  const { data: existing, error: lookupError } = await admin
    .from('instagram_handle_bonus_history')
    .select('instagram_handle, confirm_count')
    .eq('instagram_handle', normalized)
    .maybeSingle()

  if (lookupError) {
    if (lookupError.code === 'PGRST205' || lookupError.message?.includes('schema cache')) {
      console.warn('[instagram_handle_bonus_history] table missing — skip record')
      return
    }
    throw lookupError
  }

  if (existing) {
    const { error: updateError } = await admin
      .from('instagram_handle_bonus_history')
      .update({
        last_confirmed_at: confirmedIso,
        last_confirmed_user_id: userId,
        confirm_count: (existing.confirm_count ?? 1) + 1,
      })
      .eq('instagram_handle', normalized)

    if (updateError) throw updateError
    return
  }

  const { error: insertError } = await admin.from('instagram_handle_bonus_history').insert({
    instagram_handle: normalized,
    first_confirmed_at: confirmedIso,
    last_confirmed_at: confirmedIso,
    last_confirmed_user_id: userId,
    confirm_count: 1,
  })

  if (insertError) {
    // 동시 삽입 race → 한 번 더 update
    if (insertError.code === '23505') {
      const { error: retryError } = await admin
        .from('instagram_handle_bonus_history')
        .update({
          last_confirmed_at: confirmedIso,
          last_confirmed_user_id: userId,
        })
        .eq('instagram_handle', normalized)
      if (retryError) throw retryError
      return
    }
    throw insertError
  }
}
