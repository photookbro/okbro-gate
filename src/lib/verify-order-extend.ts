import type { SupabaseClient } from '@supabase/supabase-js'
import { addMonths, calculateNewExpiresAt } from '@/lib/order-verification'

type ExtendResult = {
  expiresAt: Date
  extended: boolean
}

export async function extendUserOrderVerification(
  admin: SupabaseClient,
  userId: string,
  periodMonths: number,
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
    previousExpires = addMonths(new Date(userLatestOrder.used_at), periodMonths)
  }

  const expiresAt = calculateNewExpiresAt(
    previousExpires && !Number.isNaN(previousExpires.getTime()) ? previousExpires : null,
    periodMonths,
    now
  )

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
    extended: !!previousExpires,
  }
}
