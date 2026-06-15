import { formatPassTimeSeconds } from '@/lib/geo'

export type GpsLogRow = {
  id: string
  user_id: string
  event_id: string
  passed_at: string
  notified: boolean
}

/** 푸시 본문용: "14시 32분에" */
export function formatGpsNotifyTime(passedAt: string | Date): string {
  const d = typeof passedAt === 'string' ? new Date(passedAt) : passedAt
  if (Number.isNaN(d.getTime())) return ''

  const hour = d.getHours()
  const minute = d.getMinutes()
  return `${hour}시 ${minute}분에`
}

export function buildGpsShootNotifyBody(passedAt: string | Date): string {
  const timeLabel = formatGpsNotifyTime(passedAt)
  return `${timeLabel} 오켱이 촬영했어요! 사진 확인해보세요`
}

export function formatGpsPassDisplay(passedAt: string | Date): string {
  return formatPassTimeSeconds(typeof passedAt === 'string' ? new Date(passedAt) : passedAt)
}
