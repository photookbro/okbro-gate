import type { SupabaseClient } from '@supabase/supabase-js'

export const ORDER_DUPLICATE_ERROR = '이미 사용된 주문번호입니다'

export type DuplicateUser = {
  user_id: string
  email: string
}

export type OrderDuplicateInfo = {
  is_duplicate: boolean
  duplicate_count: number
  duplicate_users: DuplicateUser[]
}

type OrderOwnerRow = {
  user_id: string
  order_number: string
}

export type DuplicateAttemptLogInput = {
  userId: string
  userEmail?: string | null
  orderNumber: string
  platform: string
  existingOrderId?: string | null
  existingUserId?: string | null
}

/** 중복 제출 시도 기록 (실패해도 본 요청을 막지 않음) */
export async function logDuplicateVerificationAttempt(
  admin: SupabaseClient,
  input: DuplicateAttemptLogInput
): Promise<void> {
  console.warn('[verify-order] duplicate attempt', {
    user_id: input.userId,
    user_email: input.userEmail ?? null,
    order_number: input.orderNumber,
    platform: input.platform,
    existing_order_id: input.existingOrderId ?? null,
    existing_user_id: input.existingUserId ?? null,
    at: new Date().toISOString(),
  })

  const { error } = await admin.from('order_verification_attempts').insert({
    user_id: input.userId,
    user_email: input.userEmail ?? null,
    order_number: input.orderNumber,
    platform: input.platform,
    outcome: 'duplicate_rejected',
    existing_order_id: input.existingOrderId ?? null,
    existing_user_id: input.existingUserId ?? null,
  })

  if (error) {
    console.error('[verify-order] duplicate attempt log failed:', error)
  }
}

export async function resolveUserEmails(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>()
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) return emailByUserId

  const { data: usersRows } = await admin.from('users').select('id, email').in('id', uniqueIds)
  for (const row of usersRows ?? []) {
    if (row.id && row.email) emailByUserId.set(row.id, row.email)
  }

  const missing = uniqueIds.filter(id => !emailByUserId.has(id))
  for (const userId of missing) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (!error && data.user?.email) {
      emailByUserId.set(userId, data.user.email)
    }
  }

  return emailByUserId
}

export function getDuplicateInfoForOrder(
  orderNumber: string,
  currentUserId: string,
  rows: OrderOwnerRow[],
  emailByUserId: Map<string, string>
): OrderDuplicateInfo {
  const normalized = orderNumber.trim()
  const otherUserIds = [
    ...new Set(
      rows
        .filter(row => row.order_number.trim() === normalized && row.user_id !== currentUserId)
        .map(row => row.user_id)
    ),
  ]

  const duplicate_users = otherUserIds.map(user_id => ({
    user_id,
    email: emailByUserId.get(user_id) ?? user_id.slice(0, 8),
  }))

  return {
    is_duplicate: duplicate_users.length > 0,
    duplicate_count: duplicate_users.length,
    duplicate_users,
  }
}

export async function fetchOrdersByNumbers(
  admin: SupabaseClient,
  orderNumbers: string[]
): Promise<OrderOwnerRow[]> {
  const numbers = [...new Set(orderNumbers.map(n => n.trim()).filter(Boolean))]
  if (numbers.length === 0) return []

  const { data, error } = await admin
    .from('orders')
    .select('user_id, order_number')
    .in('order_number', numbers)

  if (error) {
    console.error('[order-duplicate] fetch failed:', error)
    return []
  }

  return data ?? []
}

export async function buildDuplicateInfoByOrderNumber(
  admin: SupabaseClient,
  orderNumbers: string[],
  currentUserId: string
): Promise<Map<string, OrderDuplicateInfo>> {
  const rows = await fetchOrdersByNumbers(admin, orderNumbers)
  const otherUserIds = rows.filter(row => row.user_id !== currentUserId).map(row => row.user_id)
  const emailByUserId = await resolveUserEmails(admin, otherUserIds)

  const result = new Map<string, OrderDuplicateInfo>()
  for (const orderNumber of orderNumbers) {
    const normalized = orderNumber.trim()
    if (!normalized || result.has(normalized)) continue
    result.set(
      normalized,
      getDuplicateInfoForOrder(normalized, currentUserId, rows, emailByUserId)
    )
  }

  return result
}
