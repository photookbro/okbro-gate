import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'

type RequestWithHeaders = {
  headers: Headers
}

async function createAuthSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Route Handler 외 컨텍스트에서는 set 불가
          }
        },
      },
    }
  )
}

function readBearerToken(req?: RequestWithHeaders): string | null {
  const header = req?.headers.get('authorization')
  if (!header) return null

  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function getUserFromBearerToken(
  supabase: Awaited<ReturnType<typeof createAuthSupabase>>,
  token: string
): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) return null
  return user
}

export async function getAuthenticatedUser(req?: RequestWithHeaders): Promise<User | null> {
  const supabase = await createAuthSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) return user

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 세션 쿠키가 있을 때만 refresh — 로그아웃 후 빈 상태에서 세션을 되살리지 않음
  if (session?.refresh_token) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session) {
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser()
      if (refreshedUser) return refreshedUser
      return refreshed.session.user
    }
  }

  const bearerToken = readBearerToken(req)
  if (bearerToken) {
    return getUserFromBearerToken(supabase, bearerToken)
  }

  return null
}
