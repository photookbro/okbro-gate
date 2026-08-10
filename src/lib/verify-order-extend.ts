import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, calculateNewExpiresAt, latestActiveExpiresAt } from '@/lib/order-verification'
import { getActiveInstagramBonusExpiresAt } from '@/lib/instagram-follow-bonus'

type ExtendResult = {
  expiresAt: Date
  extended: boolean
}

export async function extendUserOrderVerification(
  admin: SupabaseClient,
  userId: string,
  periodDays: number,
  options?: {
    orderId?: string
    eventId?: string | null
    now?: Date
  }
): Promise<ExtendResult> {
  const now = options?.now ?? new Date()

  const { data: userLatestOrder, error: latestOrderError } = await admin
    .from('orders')
    .select('expires_at, used_at')
    .eq('user_id', userId)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestOrderError) {
    throw latestOrderError
  }

  let previousExpires: Date | null = null

  if (userLatestOrder?.expires_at) {
    previousExpires = new Date(userLatestOrder.expires_at)
  } else if (userLatestOrder?.used_at) {
    previousExpires = addDays(new Date(userLatestOrder.used_at), periodDays)
  }

  let instagramExpires: Date | null = null
  try {
    instagramExpires = await getActiveInstagramBonusExpiresAt(admin, userId, now)
  } catch {
    instagramExpires = null
  }

  const stackedBase = latestActiveExpiresAt([previousExpires, instagramExpires], now)

  const expiresAt = calculateNewExpiresAt(stackedBase, periodDays, now)

  const payload = {
    used_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ...(options?.eventId !== undefined ? { event_id: options.eventId } : {}),
  }

  if (options?.orderId) {
    const { error } = await admin.from('orders').update(payload).eq('id', options.orderId)
    if (error) throw error
  } else {
    throw new Error('orderId is required for extend update')
  }

  return {
    expiresAt,
    extended: !!stackedBase,
  }
}
