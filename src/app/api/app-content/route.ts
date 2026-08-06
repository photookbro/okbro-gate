import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_GUIDE_CONSENT_LABELS,
  createDefaultGuideBlocks,
  normalizeGuideConsentLabels,
  ONBOARDING_GUIDE_CONSENT_KEY,
  parseGuideContentBlocks,
  serializeGuideContentBlocks,
} from '@/lib/app-content'

const ALLOWED_KEYS = new Set([ONBOARDING_GUIDE_CONSENT_KEY])

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function fallbackPayload(key: string) {
  const blocks = createDefaultGuideBlocks()
  return {
    key,
    content: serializeGuideContentBlocks(blocks),
    blocks,
    consent_label_1: DEFAULT_GUIDE_CONSENT_LABELS[0],
    consent_label_2: DEFAULT_GUIDE_CONSENT_LABELS[1],
    consent_label_3: DEFAULT_GUIDE_CONSENT_LABELS[2],
    updated_at: null,
    fallback: true,
  }
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
      .select('key, content, consent_label_1, consent_label_2, consent_label_3, updated_at')
      .eq('key', key)
      .maybeSingle()

    if (error) {
      console.error('[app-content] select failed:', error.message)
      return NextResponse.json(fallbackPayload(key))
    }

    if (!data) {
      return NextResponse.json(fallbackPayload(key))
    }

    const blocks = parseGuideContentBlocks(data.content)
    return NextResponse.json({
      key: data.key,
      content: serializeGuideContentBlocks(blocks),
      blocks,
      ...normalizeGuideConsentLabels(data),
      updated_at: data.updated_at,
      fallback: false,
    })
  } catch (err) {
    console.error('[app-content] unexpected:', err)
    return NextResponse.json(fallbackPayload(key))
  }
}
