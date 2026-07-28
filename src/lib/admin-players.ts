import type { User } from '@supabase/supabase-js'
import { getMonitorStatus, resolveExpiresAt } from '@/lib/order-verification'
import { formatPassTimeSeconds } from '@/lib/geo'
import { getGpsLocationLabel, type GpsLocationNumber } from '@/lib/gps-locations'

export type GpsPassSlot = {
  pass_count: number
  passed_at_display: string | null
  notified: boolean | null
}

export type GpsLocationPassGroup = {
  location_number: GpsLocationNumber
  label: string
  passes: GpsPassSlot[]
}

export function buildGpsLogsByLocation(
  logs: {
    location_number?: number | null
    pass_count?: number | null
    passed_at?: string | null
    notified?: boolean | null
  }[],
  locationNumbers: number[]
): GpsLocationPassGroup[] {
  const numbers = locationNumbers.length > 0 ? locationNumbers : [1]
  const locationCount = numbers.length

  return numbers.map(locationNumber => {
    const locationLogs = logs.filter(log => (log.location_number ?? 1) === locationNumber)
    return {
      location_number: locationNumber as GpsLocationNumber,
      label: getGpsLocationLabel(locationNumber, locationCount),
      passes: buildGpsPassSlots(locationLogs),
    }
  })
}

/** 실제 기록된 통과만 반환 (상한 패딩 없음) */
export function buildGpsPassSlots(
  logs: { pass_count?: number | null; passed_at?: string | null; notified?: boolean | null }[]
): GpsPassSlot[] {
  const byPassCount = new Map<number, { passed_at: string; notified: boolean }>()
  for (const log of logs) {
    const count = log.pass_count ?? 1
    if (!log.passed_at || byPassCount.has(count)) continue
    byPassCount.set(count, { passed_at: log.passed_at, notified: log.notified === true })
  }

  return [...byPassCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([passCount, found]) => ({
      pass_count: passCount,
      passed_at_display: formatPassTimeSeconds(new Date(found.passed_at)),
      notified: found.notified,
    }))
}

export function getUserDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  if (typeof meta?.name === 'string' && meta.name.trim()) return meta.name.trim()
  if (typeof meta?.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim()
  return user.email?.split('@')[0] ?? '-'
}

export function formatAdminDate(date: string | Date | null | undefined): string {
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

export function formatAdminDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function maxIsoDate(...dates: (string | null | undefined)[]): string | null {
  let best: string | null = null
  let bestMs = -Infinity
  for (const raw of dates) {
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms
      best = raw
    }
  }
  return best
}

export function orderStatusLabel(
  order: { used_at?: string | null; created_at?: string | null; expires_at?: string | null },
  verifiedPeriodDays: number
): string {
  const expiresAt = resolveExpiresAt(
    {
      order_number: '',
      used_at: order.used_at ?? '',
      created_at: order.created_at,
      expires_at: order.expires_at,
    },
    verifiedPeriodDays
  )
  if (!expiresAt) return '만료'
  const status = getMonitorStatus(expiresAt)
  if (status === 'active') return '유효'
  if (status === 'expiring_soon') return '임박'
  return '만료'
}

export function formatGpsPassTime(passedAt: string): string {
  return formatPassTimeSeconds(new Date(passedAt))
}

export function formatValidityPeriod(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const startLabel = formatAdminDate(start)
  const endLabel = formatAdminDate(end)
  if (startLabel === '-' && endLabel === '-') return '-'
  if (startLabel === '-') return endLabel
  if (endLabel === '-') return startLabel
  return `${startLabel} ~ ${endLabel}`
}
