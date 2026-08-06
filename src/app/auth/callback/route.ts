import { NextRequest, NextResponse, after } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  getSetCookieHeaderCount,
  isLocalDevHost,
} from '@/lib/supabase/cookie-options'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client'
import { sendKakaoNotify } from '@/lib/kakao-notify'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { sanitizeAuthNextPath } from '@/lib/app-origin'

/** ? ???(=?? ??)?? ??: ?? ??? ?? ??? ??? ?? ??? ?? ?? */
function isFirstLogin(user: User): boolean {
  if (!user.created_at || !user.last_sign_in_at) return false
  const createdAt = new Date(user.created_at).getTime()
  const lastSignInAt = new Date(user.last_sign_in_at).getTime()
  if (Number.isNaN(createdAt) || Number.isNaN(lastSignInAt)) return false
  return Math.abs(lastSignInAt - createdAt) < 10_000
}

function authErrorRedirect(
  requestUrl: URL,
  code: string,
  detail?: string
): NextResponse {
  const url = new URL('/', requestUrl.origin)
  url.searchParams.set('error', code)
  if (detail && process.env.NODE_ENV === 'development') {
    url.searchParams.set('detail', detail.slice(0, 200))
  }
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = sanitizeAuthNextPath(requestUrl.searchParams.get('next'))

  if (error) {
    console.error('[auth/callback] oauth provider error', {
      error,
      errorDescription,
    })
    return authErrorRedirect(requestUrl, error, errorDescription ?? undefined)
  }

  if (!code) {
    console.error('[auth/callback] missing code param', {
      pathname: requestUrl.pathname,
      search: requestUrl.search,
    })
    return authErrorRedirect(requestUrl, 'missing_code')
  }

  const redirectUrl = new URL(next, requestUrl.origin)
  let response = NextResponse.redirect(redirectUrl)

  const requestCookieNames = request.cookies.getAll().map(cookie => cookie.name)
  const hasCodeVerifier = requestCookieNames.some(name => name.includes('code-verifier'))

  if (!hasCodeVerifier) {
    console.error('[auth/callback] missing PKCE code-verifier cookie', {
      requestCookieNames,
      isLocalDev: isLocalDevHost(requestUrl.hostname),
    })
  }

  const supabase = createRouteHandlerSupabaseClient(request, response)

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession failed', {
      message: exchangeError.message,
      status: exchangeError.status,
      name: exchangeError.name,
      code,
      hasCodeVerifier,
      requestCookieNames,
    })
    return authErrorRedirect(requestUrl, 'exchange_failed', exchangeError.message)
  }

  const setCookieCount = getSetCookieHeaderCount(response)
  const responseCookieNames = response.cookies.getAll().map(cookie => cookie.name)

  if (!data.session || setCookieCount === 0) {
    console.error('[auth/callback] exchange succeeded but session cookies missing', {
      hasSession: !!data.session,
      setCookieCount,
      responseCookieNames,
      userId: data.session?.user?.id ?? null,
    })
    return authErrorRedirect(requestUrl, 'session_cookie_missing')
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[auth/callback] session established', {
      userId: data.session.user.id,
      setCookieCount,
      responseCookieNames,
    })
  }

  if (isFirstLogin(data.session.user)) {
    const displayName =
      (data.session.user.user_metadata?.full_name as string | undefined) ??
      (data.session.user.user_metadata?.name as string | undefined) ??
      data.session.user.email ??
      '? ? ??'
    after(() => sendKakaoNotify(`[??GATE] ?? ??: ${displayName}`))
  }

  after(() =>
    ensureUserProfile(
      supabaseAdmin(),
      data.session.user.id,
      data.session.user.created_at ?? new Date().toISOString()
    ).catch(error => {
      console.error('[auth/callback] ensureUserProfile failed', error)
    })
  )

  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  response.headers.set('Pragma', 'no-cache')

  return response
}
