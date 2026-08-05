import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  parseShopProductsCsv,
  type ShopProductCsvRow,
} from '@/lib/shop-products'
import { parseShopFileBuffer, upsertShopProductRows } from '@/lib/shop-products-server'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shop_products')
    .select(
      'id, product_name, store_name, image_url, price_original, price_discount, affiliate_url, category, display_order, is_active, click_count, created_at'
    )
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/shop] GET', error)
    return NextResponse.json({ error: '상품 목록 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '엑셀(.xlsx) 또는 CSV 파일을 선택해주세요' }, { status: 400 })
    }
    const previewOnly = String(formData.get('preview') ?? '') === '1'
    return handleUploadedFile(file, previewOnly)
  }

  const body = await req.json().catch(() => ({}))

  if (body.preview === true && typeof body.csv_text === 'string') {
    const { rows, errors } = parseShopProductsCsv(body.csv_text)
    return NextResponse.json({
      preview: true,
      rows,
      errors,
      total: rows.length,
    })
  }

  if (typeof body.csv_text === 'string') {
    return upsertFromParsed(parseShopProductsCsv(body.csv_text), 'inline.csv')
  }

  if (Array.isArray(body.rows)) {
    return upsertRows(body.rows as ShopProductCsvRow[])
  }

  return NextResponse.json({ error: '파일 또는 csv_text / rows가 필요해요' }, { status: 400 })
}

async function handleUploadedFile(file: File, previewOnly: boolean) {
  const lower = file.name.toLowerCase()
  const isXlsx = lower.endsWith('.xlsx') || lower.endsWith('.xls')
  const isCsv = lower.endsWith('.csv') || file.type === 'text/csv'

  if (!isXlsx && !isCsv) {
    return NextResponse.json(
      { error: '엑셀(.xlsx) 또는 CSV 파일만 업로드할 수 있어요' },
      { status: 400 }
    )
  }

  let parsed: { rows: ShopProductCsvRow[]; errors: string[] }
  try {
    parsed = parseShopFileBuffer(await file.arrayBuffer(), file.name)
  } catch (error) {
    console.error('[admin/shop] parse file', error)
    return NextResponse.json({ error: '파일을 해석하지 못했어요' }, { status: 400 })
  }

  if (previewOnly) {
    return NextResponse.json({
      preview: true,
      rows: parsed.rows,
      errors: parsed.errors,
      total: parsed.rows.length,
      file_name: file.name,
    })
  }

  return upsertFromParsed(parsed, file.name)
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) {
    return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  if (typeof body.display_order === 'number' && Number.isFinite(body.display_order)) {
    patch.display_order = Math.floor(body.display_order)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '변경할 값이 없어요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shop_products')
    .update(patch)
    .eq('id', id)
    .select(
      'id, product_name, store_name, image_url, price_original, price_discount, affiliate_url, category, display_order, is_active, click_count, created_at'
    )
    .maybeSingle()

  if (error) {
    console.error('[admin/shop] PATCH', error)
    return NextResponse.json({ error: '상품 수정 실패' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '상품을 찾지 못했어요' }, { status: 404 })
  }

  return NextResponse.json({ product: data })
}

async function upsertFromParsed(
  parsed: { rows: ShopProductCsvRow[]; errors: string[] },
  fileName: string
) {
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { error: '등록할 상품이 없어요', parse_errors: parsed.errors },
      { status: 400 }
    )
  }

  try {
    const result = await upsertShopProductRows(supabaseAdmin(), parsed.rows)
    return NextResponse.json({
      success: true,
      upserted: result.upserted,
      summary: result.summary,
      file_name: fileName,
      parse_errors: parsed.errors,
    })
  } catch (error) {
    console.error('[admin/shop] upsert', error)
    const message = error instanceof Error ? error.message : '상품 저장 실패'
    return NextResponse.json({ error: '상품 저장 실패', db_error: message }, { status: 500 })
  }
}

async function upsertRows(rows: ShopProductCsvRow[]) {
  try {
    const result = await upsertShopProductRows(supabaseAdmin(), rows)
    return NextResponse.json({
      success: true,
      upserted: result.upserted,
      summary: result.summary,
    })
  } catch (error) {
    console.error('[admin/shop] upsert', error)
    const message = error instanceof Error ? error.message : '상품 저장 실패'
    return NextResponse.json({ error: '상품 저장 실패', db_error: message }, { status: 500 })
  }
}
