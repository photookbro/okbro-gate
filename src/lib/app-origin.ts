/**
 * App URL (localhost vs Vercel). NOT the Supabase project URL.
 *
 * - NEXT_PUBLIC_SUPABASE_URL → always https://xxx.supabase.co (same everywhere)
 * - OAuth redirect uses the current app origin (browser or request)
 *
 * Supabase Dashboard → Auth → URL Configuration:
 * - Site URL: production (e.g. https://okbro-gate.vercel.app)
 * - Redirect URLs: http://localhost:3000/** AND https://okbro-gate.vercel.app/**
 */
type RequestLike = {
  headers: Headers
  nextUrl?: URL
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

export function getServerAppOrigin(request?: RequestLike): string {
  if (request) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const proto =
      request.headers.get('x-forwarded-proto') ??
      (request.nextUrl?.protocol ? request.nextUrl.protocol.replace(':', '') : 'http')

    if (host) {
      return stripTrailingSlash(`${proto}://${host}`)
    }

    if (request.nextUrl) {
      return request.nextUrl.origin
    }
  }

  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) {
    return stripTrailingSlash(explicit)
  }

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return stripTrailingSlash(`https://${vercel}`)
  }

  return 'http://localhost:3000'
}

/** Browser OAuth must use the tab origin so localhost never redirects to Vercel. */
export function getBrowserAppOrigin(): string {
  if (typeof window === 'undefined') {
    return getServerAppOrigin()
  }

  return stripTrailingSlash(window.location.origin)
}

export function buildAuthCallbackUrl(next = '/', origin?: string): string {
  const base = stripTrailingSlash(origin ?? getBrowserAppOrigin())
  const safeNext = next.startsWith('/') ? next : `/${next}`
  return `${base}/auth/callback?next=${encodeURIComponent(safeNext)}`
}
