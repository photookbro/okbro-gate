import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, clientIpFromRequest } from '@/lib/rate-limit'

export function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const password = process.env.ADMIN_PASSWORD
  if (!password || !token) return false
  return token === password
}

/**
 * Prefer this in admin routes. Applies IP rate limits then token check.
 * Returns null when authorized; otherwise 401/429 response.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const ip = clientIpFromRequest(req.headers)

  const windowLimit = checkRateLimit(`admin:${ip}`, 60, 60_000)
  if (!windowLimit.ok) {
    return NextResponse.json(
      { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: { 'Retry-After': String(windowLimit.retryAfterSec) },
      }
    )
  }

  if (!verifyAdminToken(req)) {
    const failLimit = checkRateLimit(`admin-fail:${ip}`, 20, 15 * 60_000)
    if (!failLimit.ok) {
      return NextResponse.json(
        { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: { 'Retry-After': String(failLimit.retryAfterSec) },
        }
      )
    }
    return unauthorizedResponse()
  }

  return null
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '관리자 인증이 필요해요' }, { status: 401 })
}
