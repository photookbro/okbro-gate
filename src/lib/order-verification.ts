export type OrderRecord = {
  order_number: string
  used_at: string
  created_at?: string | null
  expires_at?: string | null
}

export type VerificationStatus = 'none' | 'valid' | 'expired'

export type MonitorStatus = 'active' | 'expired' | 'expiring_soon'

export type VerificationInfo = {
  status: VerificationStatus
  access_source?: 'purchase' | 'gps'
  purchase_verified?: boolean
  gps_passed_at?: string
  order_number?: string
  verified_at?: string
  expires_at?: string
  days_remaining?: number
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function getDaysRemaining(expiresAt: Date, now: Date = new Date()): number {
  const diff = expiresAt.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function calculateNewExpiresAt(
  previousExpiresAt: Date | null,
  verifiedPeriodMonths: number,
  now: Date = new Date()
): Date {
  if (previousExpiresAt && previousExpiresAt > now) {
    return addMonths(previousExpiresAt, verifiedPeriodMonths)
  }
  return addMonths(now, verifiedPeriodMonths)
}

export function resolveExpiresAt(
  order: OrderRecord,
  verifiedPeriodMonths: number
): Date | null {
  if (order.expires_at) {
    const expiresAt = new Date(order.expires_at)
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt
  }

  const verifiedAt = new Date(order.used_at || order.created_at || '')
  if (Number.isNaN(verifiedAt.getTime())) return null

  if (!Number.isFinite(verifiedPeriodMonths) || verifiedPeriodMonths <= 0) {
    return null
  }

  return addMonths(verifiedAt, verifiedPeriodMonths)
}

export function getVerificationInfo(
  order: OrderRecord | null | undefined,
  verifiedPeriodMonths: number
): VerificationInfo {
  if (!order) {
    return { status: 'none' }
  }

  const verifiedAt = new Date(order.used_at || order.created_at || '')
  if (Number.isNaN(verifiedAt.getTime())) {
    return { status: 'none' }
  }

  const expiresAt = resolveExpiresAt(order, verifiedPeriodMonths)
  if (!expiresAt) {
    return { status: 'none' }
  }

  const now = new Date()
  const status: VerificationStatus = now <= expiresAt ? 'valid' : 'expired'

  return {
    status,
    order_number: order.order_number ?? undefined,
    verified_at: verifiedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    days_remaining: getDaysRemaining(expiresAt, now),
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

export function getMonitorStatus(
  expiresAt: Date,
  now: Date = new Date()
): MonitorStatus {
  if (now > expiresAt) return 'expired'

  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + 30)
  if (expiresAt <= threshold) return 'expiring_soon'

  return 'active'
}

export function isExpiringWithinDays(
  expiresAt: Date,
  days: number,
  now: Date = new Date()
): boolean {
  if (now > expiresAt) return false
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + days)
  return expiresAt <= threshold
}
