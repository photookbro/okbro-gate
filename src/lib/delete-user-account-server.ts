import type { SupabaseClient } from '@supabase/supabase-js'

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    (typeof error.message === 'string' && error.message.includes('schema cache'))
  )
}

async function deleteUserRows(
  admin: SupabaseClient,
  table: string,
  userId: string
): Promise<void> {
  const { error } = await admin.from(table).delete().eq('user_id', userId)

  if (error && !isMissingTableError(error)) {
    throw error
  }
}

/** 회원 탈퇴: 앱 데이터 삭제 후 Supabase Auth 계정 삭제 */
export async function deleteUserAccount(admin: SupabaseClient, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('user_id required')
  }

  // FK 순서: downloads → orders, 그다음 auth.users를 참조하는 나머지 테이블
  await deleteUserRows(admin, 'downloads', userId)
  await deleteUserRows(admin, 'orders', userId)
  await deleteUserRows(admin, 'gps_logs', userId)
  await deleteUserRows(admin, 'order_verification_attempts', userId)

  await Promise.all([
    deleteUserRows(admin, 'user_gps_tracking_prefs', userId),
    deleteUserRows(admin, 'gps_tracking_prefs', userId),
    deleteUserRows(admin, 'instagram_follow_bonus', userId),
    deleteUserRows(admin, 'push_subscriptions', userId),
    deleteUserRows(admin, 'chat_messages', userId),
    deleteUserRows(admin, 'terms_agreements', userId),
    deleteUserRows(admin, 'profiles', userId),
  ])

  const { error: usersError } = await admin.from('users').delete().eq('id', userId)
  if (usersError && !isMissingTableError(usersError)) {
    throw usersError
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId)
  if (authError) {
    throw authError
  }
}
