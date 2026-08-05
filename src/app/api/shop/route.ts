import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ShopProduct } from '@/lib/shop-products'

/** Fisher–Yates — PostgREST는 ORDER BY random() 미지원 */
function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items
}

/** 공개: 활성 상품만 (요청마다 랜덤 순서) */
export async function GET() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('shop_products')
    .select(
      'id, product_name, store_name, image_url, price_original, price_discount, affiliate_url, category, display_order, is_active, click_count, created_at'
    )
    .eq('is_active', true)

  if (error) {
    console.error('[shop] GET', error)
    return NextResponse.json({ error: '상품을 불러오지 못했어요' }, { status: 500 })
  }

  const products = shuffleInPlace([...(data as ShopProduct[] | null) ?? []])
  return NextResponse.json({ products })
}
