import type { SupabaseClient } from '@supabase/supabase-js'
import { isNaverOrderNumberFormat } from '@/lib/naver-order-number'
import { buildCanonicalLookup } from '@/lib/naver-order-resolve'
import { resolveUserEmails } from '@/lib/order-duplicate'

export type SuspectKind = 'forgery' | 'duplicate'

export type SuspectOrderRow = {
  kind: SuspectKind
  order_id: string
  /** 선수가 입력·저장한 번호 */
  order_number: string
  /** 주문번호(부모) — 목록에 있을 때만 */
  canonical_order_number?: string
  user_id: string
  email: string
  name: string
  verified_at: string | null
  /** 중복 사용 시: 먼저 인증한 계정 */
  first_user_id?: string
  first_email?: string
  first_name?: string
  first_verified_at?: string | null
  first_order_number?: string
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

  const canonicalLookup = await buildCanonicalLookup(
    admin,
    candidates.map(r => r.order_number)
  )

  const allUserIds = [...new Set(candidates.map(r => r.user_id))]
  const emailByUserId = await resolveUserEmails(admin, allUserIds)

  const forgery: SuspectOrderRow[] = []
  const byCanonical = new Map<string, OrderRow[]>()

  for (const row of candidates) {
    const entered = row.order_number.trim()
    const canonical = canonicalLookup.get(entered)
    const email = emailByUserId.get(row.user_id) ?? row.user_id.slice(0, 8)

    if (!canonical) {
      forgery.push({
        kind: 'forgery',
        order_id: row.id,
        order_number: entered,
        user_id: row.user_id,
        email,
        name: email,
        verified_at: verifiedAt(row),
      })
      continue
    }

    const list = byCanonical.get(canonical) ?? []
    list.push(row)
    byCanonical.set(canonical, list)
  }

  const duplicate: SuspectOrderRow[] = []

  for (const [, peers] of byCanonical) {
    peers.sort((a, b) => {
      const ta = verifiedAt(a) ?? ''
      const tb = verifiedAt(b) ?? ''
      if (ta !== tb) return ta.localeCompare(tb)
      return a.id.localeCompare(b.id)
    })

    const first = peers[0]
    if (!first) continue

    for (let i = 1; i < peers.length; i++) {
      const row = peers[i]
      const email = emailByUserId.get(row.user_id) ?? row.user_id.slice(0, 8)
      const firstEmail = emailByUserId.get(first.user_id) ?? first.user_id.slice(0, 8)

      duplicate.push({
        kind: 'duplicate',
        order_id: row.id,
        order_number: row.order_number.trim(),
        canonical_order_number: canonicalLookup.get(row.order_number.trim()),
        user_id: row.user_id,
        email,
        name: email,
        verified_at: verifiedAt(row),
        first_user_id: first.user_id,
        first_email: firstEmail,
        first_name: firstEmail,
        first_verified_at: verifiedAt(first),
        first_order_number: first.order_number.trim(),
      })
    }
  }

  forgery.sort((a, b) => (b.verified_at ?? '').localeCompare(a.verified_at ?? ''))
  duplicate.sort((a, b) => (b.verified_at ?? '').localeCompare(a.verified_at ?? ''))

  return { forgery, duplicate }
}
