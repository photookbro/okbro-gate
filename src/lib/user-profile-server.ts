import type { SupabaseClient } from '@supabase/supabase-js'

export type UserProfileRow = {
  user_id: string
  first_created_at: string
}

export async function ensureUserProfile(
  admin: SupabaseClient,
  userId: string,
  authCreatedAt: string
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

  const firstCreatedAt = authCreatedAt || new Date().toISOString()

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
