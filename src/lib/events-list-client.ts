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
  has_album: boolean
  has_any_album: boolean
  photo_url: string | null
  gps_logs: EventsListShootRecord[]
}

export type EventsListLocation = {
  location_number: number
  lat: number
  lng: number
  radius_meters: number
}

export type EventsListGpsPassEntry = {
  pass_count: number
  display_time: string
}

export type EventsListGpsPassGroup = {
  location_number: number
  passes: EventsListGpsPassEntry[]
}

export type EventsListUpcomingEvent = {
  id: string
  name: string
  date: string
  gps_enabled: boolean
  is_pay_event: boolean
  show_gps_toggle: boolean
  is_loop_course: boolean
  photo_url: string | null
  locations: EventsListLocation[]
  shoot_record: EventsListShootRecord | null
  gps_pass_groups: EventsListGpsPassGroup[]
}

export function parseShootRecord(value: unknown): EventsListShootRecord | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  const username = typeof row.username === 'string' ? row.username.trim() : ''
  const time = typeof row.time === 'string' ? row.time.trim() : ''

  if (!username || !time) return null
  return { username, time }
}

export function parseShootRecords(value: unknown): EventsListShootRecord[] {
  if (!Array.isArray(value)) return []
  return value
    .map(parseShootRecord)
    .filter((record): record is EventsListShootRecord => record !== null)
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
    has_album: row.has_album === true,
    has_any_album: row.has_any_album === true,
    photo_url: typeof row.photo_url === 'string' && row.photo_url.trim() ? row.photo_url : null,
    gps_logs: parseShootRecords(
      row.gps_logs ?? (row.shoot_record != null ? [row.shoot_record] : [])
    ),
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
  const rawLocations = Array.isArray(row.locations) ? row.locations : []
  const locations = rawLocations
    .map((raw): EventsListLocation | null => {
      if (!raw || typeof raw !== 'object') return null
      const loc = raw as Record<string, unknown>
      const lat = Number(loc.lat)
      const lng = Number(loc.lng)
      const locationNumber = Number(loc.location_number)
      const radiusMeters = Number(loc.radius_meters)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        location_number: Number.isFinite(locationNumber) ? locationNumber : 1,
        lat,
        lng,
        radius_meters: Number.isFinite(radiusMeters) ? radiusMeters : 50,
      }
    })
    .filter((location): location is EventsListLocation => location !== null)
  const hasGpsLocations = locations.length > 0

  const rawPassGroups = Array.isArray(row.gps_pass_groups) ? row.gps_pass_groups : []
  const gps_pass_groups = rawPassGroups
    .map((raw): EventsListGpsPassGroup | null => {
      if (!raw || typeof raw !== 'object') return null
      const group = raw as Record<string, unknown>
      const locationNumber = Number(group.location_number)
      const rawPasses = Array.isArray(group.passes) ? group.passes : []
      const passes = rawPasses
        .map((rawPass): EventsListGpsPassEntry | null => {
          if (!rawPass || typeof rawPass !== 'object') return null
          const pass = rawPass as Record<string, unknown>
          const passCount = Number(pass.pass_count)
          const displayTime = typeof pass.display_time === 'string' ? pass.display_time : ''
          if (!displayTime) return null
          return { pass_count: Number.isFinite(passCount) ? passCount : 1, display_time: displayTime }
        })
        .filter((pass): pass is EventsListGpsPassEntry => pass !== null)
      if (!Number.isFinite(locationNumber) || passes.length === 0) return null
      return { location_number: locationNumber, passes }
    })
    .filter((group): group is EventsListGpsPassGroup => group !== null)

  const shoot_record = parseShootRecord(row.shoot_record)

  return {
    id,
    name,
    date,
    gps_enabled,
    is_pay_event: row.is_pay_event === true,
    show_gps_toggle: gps_enabled || hasGpsLocations,
    is_loop_course: row.is_loop_course === true,
    photo_url: typeof row.photo_url === 'string' && row.photo_url.trim() ? row.photo_url : null,
    locations,
    shoot_record,
    gps_pass_groups,
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
  '⚠️ 핸드폰 GPS 오차, 신호 송신 지연, 선수 밀집도에 따라 실제 시각과 조금 다를 수 있습니다.'

/** display_time(HH:MM:SS 등) → HH:MM */
export function formatPassTimeHm(displayTime: string): string {
  const match = displayTime.trim().match(/^(\d{1,2}:\d{2})/)
  return match ? match[1] : displayTime.trim()
}

/** 마이페이지 촬영 이력용 문장 */
export function formatOkcamPassSentence(displayTime: string, passCount?: number): string {
  const hm = formatPassTimeHm(displayTime)
  if (passCount != null && passCount > 0) {
    return `오켱 카메라 앞을 ${passCount}차 ${hm} 즈음 지나갔습니다.`
  }
  return `오켱 카메라 앞을 ${hm} 즈음 지나갔습니다.`
}

export const EVENTS_UPCOMING_SECTION_TITLE = '📅 렌즈가 기다리는 그날'
export const EVENTS_UPCOMING_ON_PROMPT = '참가 예정이면 ON으로 해주세요'
export const EVENTS_UPCOMING_ON_DETAIL = 'ON으로 해두시면 스쳐 간 순간까지 놓치지 않습니다'
export const EVENTS_PAST_SECTION_SUB_MAIN = '지난 대회 및 사진 업로드 현황'
export const EVENTS_PAST_SECTION_SUB_TAIL = '최근 12개월'

export function formatPastEventDisplayName(name: string, hasAlbum: boolean): string {
  return hasAlbum ? name : `${name} (업로드중)`
}

export function formatPastEventHeading(
  name: string,
  date: string,
  hasRecord: boolean,
  hasAlbum = true
): string {
  const icon = !hasAlbum ? '⏳' : hasRecord ? '📸' : '⏳'
  return `${icon} ${formatEventDateDisplay(date)} ${formatPastEventDisplayName(name, hasAlbum)}`
}

export function formatPastShootRecordLine(record: EventsListShootRecord): string {
  return `${record.username}님은 ${record.time}경에 오켱 카메라 앞을 지나갔습니다`
}
