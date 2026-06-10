export type OrderRecord = {
  order_number: string
  used_at: string
  created_at?: string | null
}

export type VerificationStatus = 'none' | 'valid' | 'expired'

export type VerificationInfo = {
  status: VerificationStatus
  order_number?: string
  verified_at?: string
  expires_at?: string
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function getVerificationInfo(
  order: OrderRecord | null | undefined,
  verifiedPeriodMonths: number
): VerificationInfo {
  if (!order || !Number.isFinite(verifiedPeriodMonths) || verifiedPeriodMonths <= 0) {
    return { status: 'none' }
  }

  const verifiedAt = new Date(order.used_at || order.created_at || '')
  if (Number.isNaN(verifiedAt.getTime())) {
    return { status: 'none' }
  }

  const expiresAt = addMonths(verifiedAt, verifiedPeriodMonths)
  const status: VerificationStatus = new Date() <= expiresAt ? 'valid' : 'expired'

  return {
    status,
    order_number: order.order_number ?? undefined,
    verified_at: verifiedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  }
}

export function formatVerificationDate(date: string | Date | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
