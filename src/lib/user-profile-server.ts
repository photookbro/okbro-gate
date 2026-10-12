import type { SupabaseClient } from '@supabase/supabase-js'

export type UserProfileRow = {
  user_id: string
  first_created_at: string
}

/** 토큰 클레임에는 가입 시각이 없어서, 프로필을 새로 만들 때만 계정에서 조회 */
async function lookupAuthCreatedAt(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error) return null
    return data.user?.created_at ?? null
  } catch {
    return null
  }
}

export async function ensureUserProfile(
  admin: SupabaseClient,
  userId: string,
  authCreatedAt?: string | null
): Promise<UserProfileRow> {
  const { data: existing, error: selectError } = await admin
    .from('profiles')
    .select('user_id, first_created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  if (existing?.user_id && existing.first_created_at) {
    return existing as UserProfileRow
  }

  const firstCreatedAt =
    authCreatedAt || (await lookupAuthCreatedAt(admin, userId)) || new Date().toISOString()

  const { error: insertError } = await admin.from('profiles').insert({
    user_id: userId,
    first_created_at: firstCreatedAt,
  })

  if (insertError && insertError.code !== '23505') {
    throw insertError
  }

  const { data: profile, error: reloadError } = await admin
    .from('profiles')
    .select('user_id, first_created_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (reloadError || !profile?.first_created_at) {
    throw reloadError ?? new Error('profile not found after insert')
  }

  return profile as UserProfileRow
}
