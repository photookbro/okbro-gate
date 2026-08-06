import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  DEFAULT_GUIDE_CONSENT_LABELS,
  createDefaultGuideBlocks,
  normalizeGuideConsentLabel,
  normalizeGuideConsentLabels,
  ONBOARDING_GUIDE_CONSENT_KEY,
  parseGuideContentBlocks,
  serializeGuideContentBlocks,
  validateGuideContentBlocks,
} from '@/lib/app-content'

const ALLOWED_KEYS = new Set([ONBOARDING_GUIDE_CONSENT_KEY])

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const key = req.nextUrl.searchParams.get('key')?.trim() ?? ONBOARDING_GUIDE_CONSENT_KEY
  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: '유효하지 않은 key예요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('app_content')
    .select('key, content, consent_label_1, consent_label_2, consent_label_3, updated_at')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error('[admin/app-content] select failed:', error.message)
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }

  if (!data) {
    const blocks = createDefaultGuideBlocks()
    return NextResponse.json({
      key,
      content: serializeGuideContentBlocks(blocks),
      blocks,
      consent_label_1: DEFAULT_GUIDE_CONSENT_LABELS[0],
      consent_label_2: DEFAULT_GUIDE_CONSENT_LABELS[1],
      consent_label_3: DEFAULT_GUIDE_CONSENT_LABELS[2],
      updated_at: null,
    })
  }

  const blocks = parseGuideContentBlocks(data.content)
  return NextResponse.json({
    key: data.key,
    content: serializeGuideContentBlocks(blocks),
    blocks,
    ...normalizeGuideConsentLabels(data),
    updated_at: data.updated_at,
  })
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: {
    key?: unknown
    blocks?: unknown
    content?: unknown
    consent_label_1?: unknown
    consent_label_2?: unknown
    consent_label_3?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요' }, { status: 400 })
  }

  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: '유효하지 않은 key예요' }, { status: 400 })
  }

  const validated =
    body.blocks !== undefined
      ? validateGuideContentBlocks(body.blocks)
      : validateGuideContentBlocks(parseGuideContentBlocks(body.content))

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const label1 = normalizeGuideConsentLabel(body.consent_label_1, '')
  const label2 = normalizeGuideConsentLabel(body.consent_label_2, '')
  const label3 = normalizeGuideConsentLabel(body.consent_label_3, '')

  if (!label1 || !label2 || !label3) {
    return NextResponse.json({ error: '동의 문구 1·2·3을 모두 입력해 주세요' }, { status: 400 })
  }
  if (label1.length > 500 || label2.length > 500 || label3.length > 500) {
    return NextResponse.json({ error: '동의 문구가 너무 길어요' }, { status: 400 })
  }

  const content = serializeGuideContentBlocks(validated.blocks)
  const updated_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin()
    .from('app_content')
    .upsert(
      {
        key,
        content,
        consent_label_1: label1,
        consent_label_2: label2,
        consent_label_3: label3,
        updated_at,
      },
      { onConflict: 'key' }
    )
    .select('key, content, consent_label_1, consent_label_2, consent_label_3, updated_at')
    .single()

  if (error) {
    console.error('[admin/app-content] upsert failed:', error.message)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }

  const blocks = parseGuideContentBlocks(data.content)
  return NextResponse.json({
    key: data.key,
    content: serializeGuideContentBlocks(blocks),
    blocks,
    ...normalizeGuideConsentLabels(data),
    updated_at: data.updated_at,
  })
}
