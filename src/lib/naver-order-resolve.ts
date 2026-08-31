import type { SupabaseClient } from '@supabase/supabase-js'
import { chunkArray } from '@/lib/naver-orders-parse'

export type VerifiedNaverOrderRow = {
  product_order_number: string
  order_number: string
}

export function normalizeNaverOrderDigits(
  value: string | number | boolean | null | undefined
): string {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  return text.replace(/[\s-]/g, '').replace(/[^\d]/g, '')
}

/** 입력값(상품주문번호 or 주문번호)으로 검증 목록 행 조회 */
export async function lookupVerifiedNaverOrder(
  admin: SupabaseClient,
  input: string
): Promise<VerifiedNaverOrderRow | null> {
  const normalized = input.trim()
  if (!normalized) return null

  const { data: byProduct, error: productError } = await admin
    .from('verified_naver_orders')
    .select('product_order_number, order_number')
    .eq('product_order_number', normalized)
    .maybeSingle()

  if (productError) throw productError
  if (byProduct) return byProduct

  const { data: byOrder, error: orderError } = await admin
    .from('verified_naver_orders')
    .select('product_order_number, order_number')
    .eq('order_number', normalized)
    .limit(1)
    .maybeSingle()

  if (orderError) throw orderError
  return byOrder ?? null
}

/** 주문번호 기준으로 연결된 모든 번호(주문번호 + 상품주문번호들) */
export async function getNumbersForCanonicalOrder(
  admin: SupabaseClient,
  canonicalOrderNumber: string
): Promise<string[]> {
  const { data, error } = await admin
    .from('verified_naver_orders')
    .select('product_order_number, order_number')
    .eq('order_number', canonicalOrderNumber)

  if (error) throw error

  const numbers = new Set<string>([canonicalOrderNumber])
  for (const row of data ?? []) {
    numbers.add(row.product_order_number)
    numbers.add(row.order_number)
  }
  return [...numbers]
}

export type ExistingCanonicalOrder = {
  id: string
  user_id: string
  order_number: string
}

/** 같은 주문번호(또는 그 상품주문번호)로 이미 인증된 주문 조회 */
export async function findExistingOrdersForCanonical(
  admin: SupabaseClient,
  canonicalOrderNumber: string,
  platform: string
): Promise<ExistingCanonicalOrder[]> {
  const numbers = await getNumbersForCanonicalOrder(admin, canonicalOrderNumber)
  if (numbers.length === 0) return []

  const results: ExistingCanonicalOrder[] = []
  for (const batch of chunkArray(numbers, 100)) {
    const { data, error } = await admin
      .from('orders')
      .select('id, user_id, order_number')
      .eq('platform', platform)
      .in('order_number', batch)

    if (error) throw error
    results.push(...((data as ExistingCanonicalOrder[]) ?? []))
  }

  return results
}

/** orders에 저장된 번호 → canonical 주문번호 (없으면 null) */
export async function resolveCanonicalFromStoredOrder(
  admin: SupabaseClient,
  storedOrderNumber: string
): Promise<string | null> {
  const verified = await lookupVerifiedNaverOrder(admin, storedOrderNumber.trim())
  return verified?.order_number ?? null
}

/** 배치 조회: 입력 번호 → canonical 주문번호 */
export async function buildCanonicalLookup(
  admin: SupabaseClient,
  inputs: string[]
): Promise<Map<string, string>> {
  const normalized = [...new Set(inputs.map(n => n.trim()).filter(Boolean))]
  const lookup = new Map<string, string>()
  if (normalized.length === 0) return lookup

  for (const batch of chunkArray(normalized, 200)) {
    const { data: byProduct, error: pErr } = await admin
      .from('verified_naver_orders')
      .select('product_order_number, order_number')
      .in('product_order_number', batch)

    if (pErr) throw pErr
    for (const row of byProduct ?? []) {
      lookup.set(row.product_order_number, row.order_number)
    }

    const remaining = batch.filter(n => !lookup.has(n))
    if (remaining.length === 0) continue

    const { data: byOrder, error: oErr } = await admin
      .from('verified_naver_orders')
      .select('product_order_number, order_number')
      .in('order_number', remaining)

    if (oErr) throw oErr
    for (const row of byOrder ?? []) {
      lookup.set(row.order_number, row.order_number)
      lookup.set(row.product_order_number, row.order_number)
    }
  }

  return lookup
}
