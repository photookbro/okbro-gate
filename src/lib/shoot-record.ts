import { formatPassTimeSeconds } from '@/lib/geo'

export function formatShootRecordLabel(passedAt: string | Date): string {
  const d = typeof passedAt === 'string' ? new Date(passedAt) : passedAt
  if (Number.isNaN(d.getTime())) return ''
  return `🎬 ${formatPassTimeSeconds(d)}에 촬영`
}

export function formatPastGpsPassMessage(email: string, passedAt: string | Date): string {
  const d = typeof passedAt === 'string' ? new Date(passedAt) : passedAt
  if (Number.isNaN(d.getTime())) return ''
  return `${email}님은 ${formatPassTimeSeconds(d)}에 오켱 카메라 앞을 지나갔습니다`
}
