import type { SupabaseClient } from '@supabase/supabase-js'
import {
  parseShopProductsCsv,
  parseShopProductsXlsx,
  type ShopProductCsvRow,
} from '@/lib/shop-products'

export type ShopUpsertResult = {
  upserted: number
  deleted: number
  parse_errors: string[]
  summary: string
}

export async function upsertShopProductRows(
  admin: SupabaseClient,
  rows: ShopProductCsvRow[]
): Promise<ShopUpsertResult> {
  // display_order는 DB에만 유지 (UI/정렬 미사용). upsert 시 덮어쓰지 않음.
  const payload = rows.map(row => ({
    product_name: row.product_name,
    store_name: row.store_name ?? '',
    image_url: row.image_url ?? '',
    price_original: row.price_original ?? 0,
    price_discount: row.price_discount ?? 0,
    affiliate_url: row.affiliate_url,
    category: row.category ?? '',
    is_active: true,
  }))

  const keepUrls = new Set(payload.map(row => row.affiliate_url))

  const { data, error } = await admin
    .from('shop_products')
    .upsert(payload, {
      onConflict: 'affiliate_url',
      ignoreDuplicates: false,
    })
    .select('id')

  if (error) {
    throw error
  }

  // 엑셀에 없는 기존 상품은 삭제 (목록에 엑셀 상품만 남김)
  const { data: existing, error: listError } = await admin
    .from('shop_products')
    .select('id, affiliate_url')

  if (listError) {
    throw listError
  }

  const deleteIds = (existing ?? [])
    .filter(row => !keepUrls.has(row.affiliate_url))
    .map(row => row.id)

  let deleted = 0
  const chunkSize = 100
  for (let i = 0; i < deleteIds.length; i += chunkSize) {
    const chunk = deleteIds.slice(i, i + chunkSize)
    const { error: deleteError } = await admin.from('shop_products').delete().in('id', chunk)

    if (deleteError) {
      throw deleteError
    }
    deleted += chunk.length
  }

  const upserted = data?.length ?? payload.length
  const summaryParts = [`${upserted.toLocaleString('ko-KR')}건 등록·갱신됨`]
  if (deleted > 0) {
    summaryParts.push(`엑셀에 없는 ${deleted.toLocaleString('ko-KR')}건 삭제`)
  }

  return {
    upserted,
    deleted,
    parse_errors: [],
    summary: summaryParts.join(' · '),
  }
}

export function parseShopFileBuffer(
  buffer: ArrayBuffer,
  hintName = ''
): { rows: ShopProductCsvRow[]; errors: string[] } {
  const lower = hintName.toLowerCase()
  const bytes = new Uint8Array(buffer.slice(0, 4))
  const looksZip = bytes[0] === 0x50 && bytes[1] === 0x4b // PK — xlsx
  const forceCsv = lower.endsWith('.csv')
  const forceXlsx = lower.endsWith('.xlsx') || lower.endsWith('.xls')

  if (forceXlsx || (!forceCsv && looksZip)) {
    return parseShopProductsXlsx(buffer)
  }

  const text = new TextDecoder('utf-8').decode(buffer)
  return parseShopProductsCsv(text)
}
