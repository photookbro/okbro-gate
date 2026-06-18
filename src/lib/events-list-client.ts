export function formatEventDateDisplay(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`
  }

  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

export type EventsListShootRecord = {
  username: string
  time: string
}

export type EventsListPastEvent = {
  id: string
  name: string
  date: string
  shoot_record: EventsListShootRecord | null
}

export type EventsListUpcomingEvent = {
  id: string
  name: string
  date: string
  gps_enabled: boolean
  show_gps_toggle: boolean
}

export function parseShootRecord(value: unknown): EventsListShootRecord | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const username = typeof row.username === 'string' ? row.username.trim() : ''
  const time = typeof row.time === 'string' ? row.time.trim() : ''

  if (!username || !time) return null
  return { username, time }
}

export function parsePastEvent(value: unknown): EventsListPastEvent | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const date = typeof row.date === 'string' ? row.date : ''

  if (!id || !name || !date) return null

  return {
    id,
    name,
    date,
    shoot_record: parseShootRecord(row.shoot_record),
  }
}

export function parseUpcomingEvent(value: unknown): EventsListUpcomingEvent | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const id = typeof row.id === 'string' ? row.id : ''
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const date = typeof row.date === 'string' ? row.date : ''

  if (!id || !name || !date) return null

  const gps_enabled = row.gps_enabled === true
  const locations = Array.isArray(row.locations) ? row.locations : []
  const hasGpsLocations = locations.length > 0

  return {
    id,
    name,
    date,
    gps_enabled,
    show_gps_toggle: gps_enabled || hasGpsLocations,
  }
}

export function parseEventsListResponse(data: unknown): {
  past: EventsListPastEvent[]
  upcoming: EventsListUpcomingEvent[]
} {
  if (!data || typeof data !== 'object') {
    return { past: [], upcoming: [] }
  }

  const body = data as Record<string, unknown>

  const past = Array.isArray(body.past)
    ? body.past
        .map(parsePastEvent)
        .filter((event): event is EventsListPastEvent => event !== null)
    : []

  const upcoming = Array.isArray(body.upcoming)
    ? body.upcoming
        .map(parseUpcomingEvent)
        .filter((event): event is EventsListUpcomingEvent => event !== null)
    : []

  return { past, upcoming }
}

export const GPS_SHOOT_RECORD_DISCLAIMER =
  '핸드폰 GPS 오차, 신호 송신 지연, 선수 밀집도에 따라 실제 시각과 다를 수 있습니다'

export const EVENTS_UPCOMING_SECTION_TITLE = '📅 오켱 출사 예정'
export const EVENTS_UPCOMING_ON_PROMPT = '참가 예정이면 ON으로 해주세요'
export const EVENTS_UPCOMING_ON_DETAIL =
  'ON으로 해주시면 이후 앨범을 찾으실 때 오켱 카메라 앞에 언제 지나갔는지 알려드려요'
export const EVENTS_PAST_SECTION_SUB_MAIN = '고화소 사진 UPLOAD 완료된 대회'
export const EVENTS_PAST_SECTION_SUB_TAIL = '최근 12개월'

export function formatPastEventHeading(
  name: string,
  date: string,
  hasRecord: boolean
): string {
  const icon = hasRecord ? '📸' : '⏳'
  return `${icon} ${formatEventDateDisplay(date)} ${name}`
}

export function formatPastShootRecordLine(record: EventsListShootRecord): string {
  return `${record.username}님은 ${record.time}경에 오켱 카메라 앞을 지나갔습니다`
}
