import type { CookieOptions } from '@supabase/ssr'
import type { NextResponse } from 'next/server'

type CacheHeaders = Partial<Record<string, string>>

export function isLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function normalizeSupabaseCookieOptions(
  options: CookieOptions | undefined,
  isLocalDev: boolean
): CookieOptions | undefined {
  if (!options) return options

  if (isLocalDev) {
    return {
      ...options,
      secure: false,
      sameSite: options.sameSite ?? 'lax',
      path: options.path ?? '/',
    }
  }

  return {
    ...options,
    secure: options.secure ?? true,
    sameSite: options.sameSite ?? 'lax',
    path: options.path ?? '/',
  }
}

export function applySupabaseCookiesToResponse(
  response: NextResponse,
  cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
  cacheHeaders: CacheHeaders | undefined,
  isLocalDev: boolean
) {
  for (const { name, value, options } of cookiesToSet) {
    response.cookies.set(name, value, normalizeSupabaseCookieOptions(options, isLocalDev))
  }

  if (cacheHeaders) {
    for (const [key, value] of Object.entries(cacheHeaders)) {
      if (typeof value === 'string' && value.length > 0) {
        response.headers.set(key, value)
      }
    }
  }
}

/** middleware redirect 시 name/value만 복사하면 maxAge·secure가 날아가 세션이 브라우저 종료와 함께 사라질 수 있음 */
export function copySetCookieHeaders(from: NextResponse, to: NextResponse) {
  const headers = from.headers
  if (typeof headers.getSetCookie === 'function') {
    for (const cookie of headers.getSetCookie()) {
      to.headers.append('Set-Cookie', cookie)
    }
    return
  }

  const raw = headers.get('set-cookie')
  if (raw) {
    to.headers.append('Set-Cookie', raw)
  }
}

export function getSetCookieHeaderCount(response: NextResponse): number {
  const headers = response.headers
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().length
  }

  const raw = headers.get('set-cookie')
  return raw ? 1 : 0
}
