import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { parseShopProductsCsv, type ShopProductCsvRow } from '@/lib/shop-products'

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

  // CSV 업로드 (text 또는 multipart)
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'CSV 파일을 선택해주세요' }, { status: 400 })
    }
    const text = await file.text()
    return upsertFromCsv(text, file.name)
  }

  const body = await req.json().catch(() => ({}))

  // 미리보기만
  if (body.preview === true && typeof body.csv_text === 'string') {
    const { rows, errors } = parseShopProductsCsv(body.csv_text)
    return NextResponse.json({
      preview: true,
      rows,
      errors,
      total: rows.length,
    })
  }

  // CSV 텍스트 직접 등록
  if (typeof body.csv_text === 'string') {
    return upsertFromCsv(body.csv_text, 'inline.csv')
  }

  // rows 배열 등록
  if (Array.isArray(body.rows)) {
    return upsertRows(body.rows as ShopProductCsvRow[])
  }

  return NextResponse.json({ error: 'csv_text 또는 rows가 필요해요' }, { status: 400 })
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

async function upsertFromCsv(text: string, fileName: string) {
  const { rows, errors } = parseShopProductsCsv(text)
  if (rows.length === 0) {
    return NextResponse.json(
      { error: '등록할 상품이 없어요', parse_errors: errors },
      { status: 400 }
    )
  }
  const result = await upsertRows(rows)
  const json = await result.json()
  return NextResponse.json({ ...json, file_name: fileName, parse_errors: errors })
}

async function upsertRows(rows: ShopProductCsvRow[]) {
  const admin = supabaseAdmin()
  const payload = rows.map(row => ({
    product_name: row.product_name,
    store_name: row.store_name ?? '',
    image_url: row.image_url ?? '',
    price_original: row.price_original ?? 0,
    price_discount: row.price_discount ?? 0,
    affiliate_url: row.affiliate_url,
    category: row.category ?? '',
    display_order: row.display_order ?? 0,
    is_active: true,
  }))

  // click_count는 upsert 시 덮어쓰지 않음 — 재업로드 시 기존 클릭 유지
  const { data, error } = await admin
    .from('shop_products')
    .upsert(payload, {
      onConflict: 'affiliate_url',
      ignoreDuplicates: false,
    })
    .select('id')

  if (error) {
    console.error('[admin/shop] upsert', error)
    return NextResponse.json({ error: '상품 저장 실패', db_error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    upserted: data?.length ?? payload.length,
    summary: `${payload.length.toLocaleString('ko-KR')}건 등록·갱신됨`,
  })
}
