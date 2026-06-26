import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export async function resolveClientUser(
  supabase: SupabaseClient = createClient()
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return user

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) return session.user

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
  if (!refreshError && refreshed.session?.user) {
    return refreshed.session.user
  }

  const {
    data: { user: retryUser },
  } = await supabase.auth.getUser()

  return retryUser ?? null
}

export async function buildAuthFetchInit(init: RequestInit = {}): Promise<RequestInit> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return {
    ...init,
    credentials: 'same-origin',
    headers,
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  let response = await fetch(input, await buildAuthFetchInit(init))

  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data.session) {
      response = await fetch(input, await buildAuthFetchInit(init))
    }
  }

  return response
}
