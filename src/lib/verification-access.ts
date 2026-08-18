import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateNewExpiresAt,
  formatVerificationDate,
  getDaysRemaining,
  latestActiveExpiresAt,
  resolveExpiresAt,
  stackConcurrentExpiresAt,
  type OrderRecord,
} from '@/lib/order-verification'

export type OrderExpiryRow = Pick<
  OrderRecord,
  'order_number' | 'used_at' | 'created_at' | 'expires_at'
> & {
  id?: string
  user_id?: string
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
  purchasePeriodDays: number,
  instagramBonusExpiresAt?: string | Date | null,
  now: Date = new Date()
): PhotoAccessSummary {
  let purchaseExpires: Date | null = null
  let purchaseUsed = false

  for (const order of orders) {
    if (!order.order_number?.trim()) continue
    if (!Number.isFinite(purchasePeriodDays) || purchasePeriodDays <= 0) continue

    const expiresAt = resolveExpiresAt(
      {
        order_number: order.order_number,
        used_at: order.used_at ?? '',
        created_at: order.created_at,
        expires_at: order.expires_at,
      },
      purchasePeriodDays
    )
    if (!expiresAt) continue

    purchaseUsed = true
    if (!purchaseExpires || expiresAt > purchaseExpires) purchaseExpires = expiresAt
  }

  const purchase = buildBucket(purchaseExpires, purchaseUsed, now)
  const instagramExpires =
    instagramBonusExpiresAt != null ? new Date(instagramBonusExpiresAt) : null
  const instagramActive =
    !!instagramExpires &&
    !Number.isNaN(instagramExpires.getTime()) &&
    getNonNegativeDaysRemaining(instagramExpires, now) > 0
  let photoAccessExpires = latestActiveExpiresAt(
    [purchaseExpires, instagramActive ? instagramExpires : null],
    now
  )

  if (purchase.days_remaining > 0 && instagramActive && purchaseExpires && instagramExpires) {
    photoAccessExpires = stackConcurrentExpiresAt(purchaseExpires, instagramExpires, now)
  }

  const photoAccessDaysRemaining = getNonNegativeDaysRemaining(photoAccessExpires, now)

  return {
    purchase,
    photo_access_days_remaining: photoAccessDaysRemaining,
    status: photoAccessDaysRemaining > 0 ? 'valid' : purchaseUsed || instagramExpires ? 'expired' : 'none',
  }
}

export async function extendActiveOrdersForPeriodChange(
  admin: SupabaseClient,
  options: {
    periodDays: number
    now?: Date
  }
): Promise<number> {
  const now = options.now ?? new Date()
  const newExpiresAt = calculateNewExpiresAt(null, options.periodDays, now).toISOString()

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
      return true
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
