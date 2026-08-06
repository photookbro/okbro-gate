import type { SupabaseClient } from '@supabase/supabase-js'
import { isNaverOrderNumberFormat } from '@/lib/naver-order-number'
import { resolveUserEmails } from '@/lib/order-duplicate'
import { chunkArray } from '@/lib/naver-orders-parse'

export type SuspectKind = 'forgery' | 'duplicate'

export type SuspectOrderRow = {
  kind: SuspectKind
  order_id: string
  order_number: string
  user_id: string
  email: string
  name: string
  verified_at: string | null
  /** 중복 사용 시: 먼저 인증한 계정 */
  first_user_id?: string
  first_email?: string
  first_name?: string
  first_verified_at?: string | null
}

type OrderRow = {
  id: string
  user_id: string
  order_number: string
  used_at: string | null
  created_at: string | null
  platform: string | null
}

function verifiedAt(row: OrderRow): string | null {
  return row.used_at ?? row.created_at ?? null
}

export async function findSuspectNaverOrders(
  admin: SupabaseClient
): Promise<{ forgery: SuspectOrderRow[]; duplicate: SuspectOrderRow[] }> {
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, user_id, order_number, used_at, created_at, platform')

  if (error) {
    console.error('[naver-orders-reconcile] orders', error)
    throw new Error('주문 목록 조회 실패')
  }

  const candidates = ((orders as OrderRow[] | null) ?? []).filter(row => {
    const n = (row.order_number ?? '').trim()
    if (!n) return false
    return isNaverOrderNumberFormat(n)
  })

  if (candidates.length === 0) {
    return { forgery: [], duplicate: [] }
  }

  const uniqueNumbers = [...new Set(candidates.map(r => r.order_number.trim()))]
  const verified = new Set<string>()

  for (const batch of chunkArray(uniqueNumbers, 500)) {
    const { data, error: vErr } = await admin
      .from('verified_naver_orders')
      .select('order_number')
      .in('order_number', batch)

    if (vErr) {
      console.error('[naver-orders-reconcile] verified', vErr)
      throw new Error('검증 주문번호 조회 실패')
    }

    for (const row of data ?? []) {
      if (typeof row.order_number === 'string') verified.add(row.order_number)
    }
  }

  // order_number → 인증 시각순 정렬된 주문들
  const byNumber = new Map<string, OrderRow[]>()
  for (const row of candidates) {
    const key = row.order_number.trim()
    const list = byNumber.get(key) ?? []
    list.push(row)
    byNumber.set(key, list)
  }
  for (const list of byNumber.values()) {
    list.sort((a, b) => {
      const ta = verifiedAt(a) ?? ''
      const tb = verifiedAt(b) ?? ''
      if (ta !== tb) return ta.localeCompare(tb)
      return a.id.localeCompare(b.id)
    })
  }

  const forgery: SuspectOrderRow[] = []
  const duplicate: SuspectOrderRow[] = []

  const allUserIds = [...new Set(candidates.map(r => r.user_id))]
  const emailByUserId = await resolveUserEmails(admin, allUserIds)

  for (const row of candidates) {
    const orderNumber = row.order_number.trim()
    const email = emailByUserId.get(row.user_id) ?? row.user_id.slice(0, 8)
    const name = email

    if (!verified.has(orderNumber)) {
      forgery.push({
        kind: 'forgery',
        order_id: row.id,
        order_number: orderNumber,
        user_id: row.user_id,
        email,
        name,
        verified_at: verifiedAt(row),
      })
      continue
    }

    const peers = byNumber.get(orderNumber) ?? []
    const first = peers[0]
    if (!first) continue

    // 같은 번호로 여러 계정이 있으면, 첫 계정 이후는 중복 사용
    if (peers.length > 1 && first.user_id !== row.user_id) {
      const firstEmail = emailByUserId.get(first.user_id) ?? first.user_id.slice(0, 8)
      duplicate.push({
        kind: 'duplicate',
        order_id: row.id,
        order_number: orderNumber,
        user_id: row.user_id,
        email,
        name,
        verified_at: verifiedAt(row),
        first_user_id: first.user_id,
        first_email: firstEmail,
        first_name: firstEmail,
        first_verified_at: verifiedAt(first),
      })
    }
  }

  forgery.sort((a, b) => (b.verified_at ?? '').localeCompare(a.verified_at ?? ''))
  duplicate.sort((a, b) => (b.verified_at ?? '').localeCompare(a.verified_at ?? ''))

  return { forgery, duplicate }
}
