import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ONBOARDING_GUIDE_CONSENT_FALLBACK,
  ONBOARDING_GUIDE_CONSENT_KEY,
} from '@/lib/app-content'

const ALLOWED_KEYS = new Set([ONBOARDING_GUIDE_CONSENT_KEY])

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

/** Public read — login 전 온보딩에서도 사용. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')?.trim() ?? ''
  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: '유효하지 않은 key예요' }, { status: 400 })
  }

  try {
    const { data, error } = await anonClient()
      .from('app_content')
      .select('key, content, updated_at')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      console.error('[app-content] select failed:', error.message)
      return NextResponse.json({
        key,
        content: key === ONBOARDING_GUIDE_CONSENT_KEY ? ONBOARDING_GUIDE_CONSENT_FALLBACK : '',
        updated_at: null,
        fallback: true,
      })
    }

    if (!data) {
      return NextResponse.json({
        key,
        content: key === ONBOARDING_GUIDE_CONSENT_KEY ? ONBOARDING_GUIDE_CONSENT_FALLBACK : '',
        updated_at: null,
        fallback: true,
      })
    }

    return NextResponse.json({
      key: data.key,
      content: data.content,
      updated_at: data.updated_at,
      fallback: false,
    })
  } catch (err) {
    console.error('[app-content] unexpected:', err)
    return NextResponse.json({
      key,
      content: key === ONBOARDING_GUIDE_CONSENT_KEY ? ONBOARDING_GUIDE_CONSENT_FALLBACK : '',
      updated_at: null,
      fallback: true,
    })
  }
}
