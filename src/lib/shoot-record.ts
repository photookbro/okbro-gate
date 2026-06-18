import { formatPassTimeSeconds } from '@/lib/geo'

export function emailToUsername(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return '회원'
  const at = trimmed.indexOf('@')
  return at > 0 ? trimmed.slice(0, at) : trimmed
}

export function formatPassTimeMinutes(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export type PastGpsPassDisplay = {
  username: string
  time: string
}

export function buildPastGpsPassDisplay(email: string, passedAt: string | Date): PastGpsPassDisplay | null {
  const d = typeof passedAt === 'string' ? new Date(passedAt) : passedAt
  if (Number.isNaN(d.getTime())) return null
  const time = formatPassTimeMinutes(d)
  if (!time) return null
  return {
    username: emailToUsername(email),
    time,
  }
}

export function formatShootRecordLabel(passedAt: string | Date): string {
  const d = typeof passedAt === 'string' ? new Date(passedAt) : passedAt
  if (Number.isNaN(d.getTime())) return ''
  return `🎬 ${formatPassTimeSeconds(d)}에 촬영`
}

/** @deprecated API 응답은 shoot_record_display 사용 */
export function formatPastGpsPassMessage(email: string, passedAt: string | Date): string {
  const display = buildPastGpsPassDisplay(email, passedAt)
  if (!display) return ''
  return `${display.username}님은 ${display.time}경에 오켱 카메라 앞을 지나갔습니다`
}