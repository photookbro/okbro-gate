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
  if (!options || !isLocalDev) return options

  return {
    ...options,
    secure: false,
    sameSite: options.sameSite ?? 'lax',
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

export function getSetCookieHeaderCount(response: NextResponse): number {
  const headers = response.headers
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().length
  }

  const raw = headers.get('set-cookie')
  return raw ? 1 : 0
}
