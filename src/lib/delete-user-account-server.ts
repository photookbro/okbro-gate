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

  await Promise.all([
    deleteUserRows(admin, 'gps_logs', userId),
    deleteUserRows(admin, 'orders', userId),
    deleteUserRows(admin, 'downloads', userId),
    deleteUserRows(admin, 'order_verification_attempts', userId),
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
