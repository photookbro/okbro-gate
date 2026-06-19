import type { SupabaseClient } from '@supabase/supabase-js'
import {
  addDays,
  formatVerificationDate,
  getDaysRemaining,
  resolveExpiresAt,
  type OrderRecord,
} from '@/lib/order-verification'

export type OrderExpiryRow = Pick<
  OrderRecord,
  'order_number' | 'used_at' | 'created_at' | 'expires_at'
> & {
  id?: string
  user_id?: string
}

export function isHipassOrderNumber(
  orderNumber: string | null | undefined,
  sharedOrderNumber: string
): boolean {
  if (!sharedOrderNumber.trim() || !orderNumber?.trim()) return false
  return orderNumber.trim().toLowerCase() === sharedOrderNumber.trim().toLowerCase()
}

export function getNonNegativeDaysRemaining(
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): number {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return 0
  return Math.max(0, getDaysRemaining(expiresAt, now))
}

export type VerificationBucket = {
  used: boolean
  expires_at: string | null
  days_remaining: number
  validity_label: string
}

export type PhotoAccessSummary = {
  hipass: VerificationBucket
  purchase: VerificationBucket
  photo_access_days_remaining: number
  status: 'valid' | 'expired' | 'none'
}

function buildBucket(expiresAt: Date | null, used: boolean, now: Date): VerificationBucket {
  const daysRemaining = getNonNegativeDaysRemaining(expiresAt, now)
  const isActive = daysRemaining > 0

  return {
    used,
    expires_at: expiresAt?.toISOString() ?? null,
    days_remaining: daysRemaining,
    validity_label: !used
      ? '-'
      : isActive
        ? `${formatVerificationDate(expiresAt)}까지 유효`
        : '만료됨',
  }
}

export function buildPhotoAccessSummary(
  orders: OrderExpiryRow[],
  sharedOrderNumber: string,
  hipassPeriodDays: number,
  purchasePeriodDays: number,
  now: Date = new Date()
): PhotoAccessSummary {
  let hipassExpires: Date | null = null
  let purchaseExpires: Date | null = null
  let hipassUsed = false
  let purchaseUsed = false

  for (const order of orders) {
    if (!order.order_number?.trim()) continue

    const hipass = isHipassOrderNumber(order.order_number, sharedOrderNumber)
    const periodDays = hipass ? hipassPeriodDays : purchasePeriodDays
    if (!Number.isFinite(periodDays) || periodDays <= 0) continue

    const expiresAt = resolveExpiresAt(
      {
        order_number: order.order_number,
        used_at: order.used_at ?? '',
        created_at: order.created_at,
        expires_at: order.expires_at,
      },
      periodDays
    )
    if (!expiresAt) continue

    if (hipass) {
      hipassUsed = true
      if (!hipassExpires || expiresAt > hipassExpires) hipassExpires = expiresAt
    } else {
      purchaseUsed = true
      if (!purchaseExpires || expiresAt > purchaseExpires) purchaseExpires = expiresAt
    }
  }

  const hipass = buildBucket(hipassExpires, hipassUsed, now)
  const purchase = buildBucket(purchaseExpires, purchaseUsed, now)
  const totalDays = hipass.days_remaining + purchase.days_remaining

  return {
    hipass,
    purchase,
    photo_access_days_remaining: totalDays,
    status: totalDays > 0 ? 'valid' : hipassUsed || purchaseUsed ? 'expired' : 'none',
  }
}

export async function extendActiveOrdersForPeriodChange(
  admin: SupabaseClient,
  options: {
    sharedOrderNumber: string
    periodDays: number
    kind: 'hipass' | 'purchase'
    now?: Date
  }
): Promise<number> {
  const now = options.now ?? new Date()
  const newExpiresAt = addDays(now, options.periodDays).toISOString()

  const { data: orders, error } = await admin
    .from('orders')
    .select('id, order_number, expires_at')

  if (error) {
    throw error
  }

  const targetIds = (orders ?? [])
    .filter(order => {
      if (!order.expires_at) return false
      if (new Date(order.expires_at) <= now) return false
      const hipass = isHipassOrderNumber(order.order_number, options.sharedOrderNumber)
      return options.kind === 'hipass' ? hipass : !hipass
    })
    .map(order => order.id)

  if (targetIds.length === 0) return 0

  const { error: updateError } = await admin
    .from('orders')
    .update({ expires_at: newExpiresAt })
    .in('id', targetIds)

  if (updateError) {
    throw updateError
  }

  return targetIds.length
}
