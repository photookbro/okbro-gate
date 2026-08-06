import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ONBOARDING_GUIDE_CONSENT_FALLBACK,
  ONBOARDING_GUIDE_CONSENT_KEY,
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
    .select('key, content, updated_at')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error('[admin/app-content] select failed:', error.message)
    return NextResponse.json({ error: '조회 실패' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      key,
      content: key === ONBOARDING_GUIDE_CONSENT_KEY ? ONBOARDING_GUIDE_CONSENT_FALLBACK : '',
      updated_at: null,
    })
  }

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: { key?: unknown; content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요' }, { status: 400 })
  }

  const key = typeof body.key === 'string' ? body.key.trim() : ''
  const content = typeof body.content === 'string' ? body.content : null

  if (!key || !ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: '유효하지 않은 key예요' }, { status: 400 })
  }
  if (content === null) {
    return NextResponse.json({ error: 'content가 필요해요' }, { status: 400 })
  }
  if (content.trim().length === 0) {
    return NextResponse.json({ error: '내용을 비울 수 없어요' }, { status: 400 })
  }
  if (content.length > 100_000) {
    return NextResponse.json({ error: '내용이 너무 길어요' }, { status: 400 })
  }

  const updated_at = new Date().toISOString()
  const { data, error } = await supabaseAdmin()
    .from('app_content')
    .upsert({ key, content, updated_at }, { onConflict: 'key' })
    .select('key, content, updated_at')
    .single()

  if (error) {
    console.error('[admin/app-content] upsert failed:', error.message)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }

  return NextResponse.json(data)
}
