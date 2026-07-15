import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  applySupabaseCookiesToResponse,
  isLocalDevHost,
} from '@/lib/supabase/cookie-options'

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

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  // /api/admin 은 세션 미들웨어 불필요 + multipart 업로드 body 를 middleware 프록시로 받지 않음
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/admin|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
