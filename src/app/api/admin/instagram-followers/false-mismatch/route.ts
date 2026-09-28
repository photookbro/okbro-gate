import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  previewInstagramFalseMismatchRecovery,
  recoverInstagramFalseMismatches,
} from '@/lib/instagram-follow-false-mismatch-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 300

const MAX_RECOVER_IDS = 5000

/** 부분 업로드로 잘못 회수된 불일치 건 미리보기 (DB 변경 없음) */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const preview = await previewInstagramFalseMismatchRecovery(supabaseAdmin())
    return NextResponse.json({ success: true, ...preview })
  } catch (error) {
    console.error('[admin/instagram-followers/false-mismatch] GET', error)
    return NextResponse.json({ error: '복구 대상 조회에 실패했어요' }, { status: 500 })
  }
}

/** 미리보기에서 확인한 id만 승인 + 불일치 해제 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않아요' }, { status: 400 })
  }

  const rawIds = (body as { ids?: unknown })?.ids
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: '복구할 대상이 없어요' }, { status: 400 })
  }
  if (ids.length > MAX_RECOVER_IDS) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_RECOVER_IDS}건까지 복구할 수 있어요` },
      { status: 400 }
    )
  }

  try {
    const result = await recoverInstagramFalseMismatches(supabaseAdmin(), ids)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[admin/instagram-followers/false-mismatch] POST', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '복구 실행에 실패했어요' },
      { status: 500 }
    )
  }
}
