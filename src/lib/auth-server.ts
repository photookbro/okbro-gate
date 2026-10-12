import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { JwtPayload, User } from '@supabase/supabase-js'

type RequestWithHeaders = {
  headers: Headers
}

/**
 * 서명 검증된 access token 클레임으로 만든 사용자.
 * 토큰에 없는 값(created_at 등)은 비어 있고, app_metadata 는 토큰 발급 시점 기준.
 */
export type AuthenticatedUser = Pick<
  User,
  'id' | 'email' | 'phone' | 'app_metadata' | 'user_metadata' | 'is_anonymous'
> & {
  created_at?: string
}

type AuthSupabase = Awaited<ReturnType<typeof createAuthSupabase>>

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

function userFromClaims(claims: JwtPayload): AuthenticatedUser | null {
  if (!claims.sub || claims.role !== 'authenticated') return null
  return {
    id: claims.sub,
    email: claims.email,
    phone: claims.phone,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    is_anonymous: claims.is_anonymous,
  }
}

/**
 * getClaims 는 비대칭 서명 키(ES256)면 JWKS 캐시로 로컬 검증 — /auth/v1/user 호출 없음.
 * 대칭 키 프로젝트라면 내부적으로 getUser 로 폴백.
 */
async function verifyClaims(supabase: AuthSupabase, jwt?: string): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabase.auth.getClaims(jwt)
  if (error || !data?.claims) return null
  return userFromClaims(data.claims)
}

export async function getAuthenticatedUser(
  req?: RequestWithHeaders
): Promise<AuthenticatedUser | null> {
  const supabase = await createAuthSupabase()

  const cookieUser = await verifyClaims(supabase)
  if (cookieUser) return cookieUser

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // 세션 쿠키가 있을 때만 refresh — 로그아웃 후 빈 상태에서 세션을 되살리지 않음
  if (session?.refresh_token) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session) {
      const refreshedUser = await verifyClaims(supabase, refreshed.session.access_token)
      if (refreshedUser) return refreshedUser
    }
  }

  const bearerToken = readBearerToken(req)
  if (bearerToken) {
    return verifyClaims(supabase, bearerToken)
  }

  return null
}
