import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { downloadOneDriveSharedFile } from '@/lib/onedrive-shop-file'
import { parseShopFileBuffer, upsertShopProductRows } from '@/lib/shop-products-server'
import { supabaseAdmin } from '@/lib/supabase'

type TriggeredBy = 'cron' | 'admin'

function verifyShopSyncSecret(req: NextRequest): boolean {
  const secret = process.env.SHOP_SYNC_SECRET
  if (!secret) return false

  const auth = req.headers.get('authorization') || ''
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer && bearer === secret) return true

  // 동일 시크릿을 x-shop-sync-secret 로도 허용
  const headerSecret = req.headers.get('x-shop-sync-secret')
  return !!headerSecret && headerSecret === secret
}

function authorizeShopSync(req: NextRequest): { ok: true; triggeredBy: TriggeredBy } | { ok: false } {
  if (verifyShopSyncSecret(req)) return { ok: true, triggeredBy: 'cron' }
  if (verifyAdminToken(req)) return { ok: true, triggeredBy: 'admin' }
  return { ok: false }
}

export async function GET(req: NextRequest) {
  const auth = authorizeShopSync(req)
  if (!auth.ok) return unauthorizedResponse()

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shop_sync_runs')
    .select(
      'id, started_at, finished_at, success, rows_upserted, error_message, source_url, triggered_by, file_name'
    )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[admin/shop-sync] GET', error)
    return NextResponse.json({ error: '동기화 이력 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ last_sync: data ?? null })
}

export async function POST(req: NextRequest) {
  const auth = authorizeShopSync(req)
  if (!auth.ok) return unauthorizedResponse()

  return runShopSync(auth.triggeredBy)
}

async function runShopSync(triggeredBy: TriggeredBy) {
  const sourceUrl = process.env.ONEDRIVE_SHOP_FILE_URL?.trim() || ''
  if (!sourceUrl) {
    return NextResponse.json(
      { error: 'ONEDRIVE_SHOP_FILE_URL 환경변수가 없어요' },
      { status: 500 }
    )
  }

  const admin = supabaseAdmin()
  const startedAt = new Date().toISOString()

  const { data: runRow, error: insertError } = await admin
    .from('shop_sync_runs')
    .insert({
      started_at: startedAt,
      success: false,
      rows_upserted: 0,
      source_url: sourceUrl,
      triggered_by: triggeredBy,
    })
    .select('id')
    .single()

  if (insertError || !runRow) {
    console.error('[admin/shop-sync] insert run', insertError)
    return NextResponse.json({ error: '동기화 이력 생성 실패' }, { status: 500 })
  }

  const runId = runRow.id as string

  try {
    const downloaded = await downloadOneDriveSharedFile(sourceUrl)
    const parsed = parseShopFileBuffer(downloaded.buffer, downloaded.fileNameHint)

    if (parsed.rows.length === 0) {
      const message =
        parsed.errors[0] || '파일에서 상품 행을 찾지 못했어요 (상품명·제휴링크 확인)'
      await finishRun(admin, runId, {
        success: false,
        rows_upserted: 0,
        error_message: message,
        file_name: downloaded.fileNameHint,
      })
      return NextResponse.json(
        {
          success: false,
          error: message,
          parse_errors: parsed.errors,
          file_name: downloaded.fileNameHint,
        },
        { status: 400 }
      )
    }

    const result = await upsertShopProductRows(admin, parsed.rows)
    await finishRun(admin, runId, {
      success: true,
      rows_upserted: result.upserted,
      error_message: parsed.errors.length ? parsed.errors.slice(0, 5).join(' | ') : null,
      file_name: downloaded.fileNameHint,
    })

    return NextResponse.json({
      success: true,
      rows_upserted: result.upserted,
      summary: result.summary,
      parse_errors: parsed.errors,
      file_name: downloaded.fileNameHint,
      final_url: downloaded.finalUrl,
      triggered_by: triggeredBy,
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[admin/shop-sync] failed', error)
    await finishRun(admin, runId, {
      success: false,
      rows_upserted: 0,
      error_message: message,
      file_name: null,
    })
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

async function finishRun(
  admin: ReturnType<typeof supabaseAdmin>,
  runId: string,
  patch: {
    success: boolean
    rows_upserted: number
    error_message: string | null
    file_name: string | null
  }
) {
  const { error } = await admin
    .from('shop_sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      success: patch.success,
      rows_upserted: patch.rows_upserted,
      error_message: patch.error_message,
      file_name: patch.file_name,
    })
    .eq('id', runId)

  if (error) {
    console.error('[admin/shop-sync] finish run', error)
  }
}
