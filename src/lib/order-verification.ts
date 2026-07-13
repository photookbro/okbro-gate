export const USER_EXPIRY_WARNING_DAYS = 7
export const ADMIN_EXPIRY_SOON_DAYS = 30

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

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function calculateNewExpiresAt(
  previousExpiresAt: Date | null,
  verifiedPeriodDays: number,
  now: Date = new Date()
): Date {
  if (previousExpiresAt && previousExpiresAt > now) {
    return addDays(previousExpiresAt, verifiedPeriodDays)
  }
  return addDays(now, verifiedPeriodDays)
}

export function resolveExpiresAt(
  order: OrderRecord,
  verifiedPeriodDays: number
): Date | null {
  if (order.expires_at) {
    const expiresAt = new Date(order.expires_at)
    if (!Number.isNaN(expiresAt.getTime())) return expiresAt
  }

  const verifiedAt = new Date(order.used_at || order.created_at || '')
  if (Number.isNaN(verifiedAt.getTime())) return null

  if (!Number.isFinite(verifiedPeriodDays) || verifiedPeriodDays <= 0) {
    return null
  }

  return addDays(verifiedAt, verifiedPeriodDays)
}

export function getVerificationInfo(
  order: OrderRecord | null | undefined,
  verifiedPeriodDays: number
): VerificationInfo {
  if (!order) {
    return { status: 'none' }
  }

  const verifiedAt = new Date(order.used_at || order.created_at || '')
  if (Number.isNaN(verifiedAt.getTime())) {
    return { status: 'none' }
  }

  const expiresAt = resolveExpiresAt(order, verifiedPeriodDays)
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

export function getDaysRemaining(expiresAt: Date, now: Date = new Date()): number {
  const diff = expiresAt.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function formatVerificationDate(date: string | Date | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatOrderHistoryDate(
  orderNumber: string,
  verifiedAt?: string | null
): string {
  const compact = orderNumber.match(/^(\d{4})(\d{2})(\d{2})\d{8}$/)
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`
  }

  const dashed = orderNumber.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dashed) return dashed[1]

  if (verifiedAt) {
    const d = new Date(verifiedAt)
    if (!Number.isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }

  return orderNumber
}

export function isUserExpiringSoon(expiresAt: Date, now: Date = new Date()): boolean {
  return isExpiringWithinDays(expiresAt, USER_EXPIRY_WARNING_DAYS, now)
}

export function getMonitorStatus(
  expiresAt: Date,
  now: Date = new Date(),
  soonDays: number = ADMIN_EXPIRY_SOON_DAYS
): MonitorStatus {
  if (now > expiresAt) return 'expired'

  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() + soonDays)
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

export function isOrderDateWithinVerifiedPeriod(
  orderDate: Date,
  verifiedPeriodDays: number,
  now: Date = new Date()
): boolean {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - verifiedPeriodDays)
  return orderDate >= cutoff
}
