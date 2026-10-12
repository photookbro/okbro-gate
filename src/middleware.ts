import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  applySupabaseCookiesToResponse,
  copySetCookieHeaders,
  isLocalDevHost,
} from '@/lib/supabase/cookie-options'
import { isGuestPublicPath } from '@/lib/guest-routes'

function shouldSkipMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.[^/]+$/.test(pathname)
  )
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(cookie => {
    to.cookies.set(cookie.name, cookie.value)
  })
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })
  const isLocalDev = isLocalDevHost(request.nextUrl.hostname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          applySupabaseCookiesToResponse(
            supabaseResponse,
            cookiesToSet,
            cacheHeaders,
            isLocalDev
          )
        },
      },
    }
  )

  // getClaims: 만료 임박 시 세션 갱신(쿠키 반영) + ES256 서명 로컬 검증 — /auth/v1/user 호출 없음
  const { data: claimsData } = await supabase.auth.getClaims()
  const isLoggedIn = !!claimsData?.claims?.sub

  // API 는 각 라우트에서 401 처리 — 페이지 HTML 리다이렉트 하지 않음
  const isApi = pathname.startsWith('/api/')

  if (!isLoggedIn && !isApi && !isGuestPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''

    const nextPath = `${pathname}${request.nextUrl.search}`
    if (nextPath && nextPath !== '/login') {
      loginUrl.searchParams.set('next', nextPath)
    }

    const redirectResponse = NextResponse.redirect(loginUrl)
    copySetCookieHeaders(supabaseResponse, redirectResponse)
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  // /api/admin 은 세션 미들웨어 불필요 + multipart 업로드 body 를 middleware 프록시로 받지 않음
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/admin|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
