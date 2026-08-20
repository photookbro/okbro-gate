import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return users
}
