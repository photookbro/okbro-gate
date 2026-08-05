import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/** 공개: 활성 상품만 */
export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shop_products')
    .select(
      'id, product_name, store_name, image_url, price_original, price_discount, affiliate_url, category, display_order, is_active, click_count, created_at'
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[shop] GET', error)
    return NextResponse.json({ error: '상품을 불러오지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}
