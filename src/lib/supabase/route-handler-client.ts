import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import {
  applySupabaseCookiesToResponse,
  isLocalDevHost,
} from '@/lib/supabase/cookie-options'

export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  const isLocalDev = isLocalDevHost(request.nextUrl.hostname)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, cacheHeaders) {
          applySupabaseCookiesToResponse(response, cookiesToSet, cacheHeaders, isLocalDev)
        },
      },
    }
  )
}
