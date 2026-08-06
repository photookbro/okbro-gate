import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** 공개: 제휴 클릭 수 증가 (fire-and-forget용) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : ''
  if (!productId) {
    return NextResponse.json({ error: 'product_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: row, error: findError } = await admin
    .from('shop_products')
    .select('id, click_count, is_active')
    .eq('id', productId)
    .maybeSingle()

  if (findError) {
    console.error('[shop/click] find', findError)
    return NextResponse.json({ error: '클릭 기록 실패' }, { status: 500 })
  }
  if (!row || !row.is_active) {
    return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
  }

  const nextCount = (typeof row.click_count === 'number' ? row.click_count : 0) + 1
  const { error } = await admin
    .from('shop_products')
    .update({ click_count: nextCount })
    .eq('id', productId)

  if (error) {
    console.error('[shop/click] update', error)
    return NextResponse.json({ error: '클릭 기록 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true, click_count: nextCount })
}
