export type GpsLocationNumber = 1 | 2 | 3

export const MAX_GPS_LOCATIONS = 3

export type EventGpsLocation = {
  locationNumber: GpsLocationNumber
  lat: number
  lng: number
  radiusMeters: number
}

export type EventGpsFields = {
  gps_1_lat?: number | null
  gps_1_lng?: number | null
  gps_1_radius_meters?: number | null
  gps_2_lat?: number | null
  gps_2_lng?: number | null
  gps_2_radius_meters?: number | null
  gps_3_lat?: number | null
  gps_3_lng?: number | null
  gps_3_radius_meters?: number | null
  gps_lat?: number | null
  gps_lng?: number | null
  gps_radius_meters?: number | null
}

function parseRadius(value: number | null | undefined, fallback = 50): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

export function getEventGpsLocations(event: EventGpsFields): EventGpsLocation[] {
  const locations: EventGpsLocation[] = []

  const lat1 = event.gps_1_lat ?? event.gps_lat
  const lng1 = event.gps_1_lng ?? event.gps_lng
  if (lat1 != null && lng1 != null) {
    locations.push({
      locationNumber: 1,
      lat: lat1,
      lng: lng1,
      radiusMeters: parseRadius(event.gps_1_radius_meters ?? event.gps_radius_meters),
    })
  }

  if (event.gps_2_lat != null && event.gps_2_lng != null) {
    locations.push({
      locationNumber: 2,
      lat: event.gps_2_lat,
      lng: event.gps_2_lng,
      radiusMeters: parseRadius(event.gps_2_radius_meters),
    })
  }

  if (event.gps_3_lat != null && event.gps_3_lng != null) {
    locations.push({
      locationNumber: 3,
      lat: event.gps_3_lat,
      lng: event.gps_3_lng,
      radiusMeters: parseRadius(event.gps_3_radius_meters),
    })
  }

  return locations
}

export function getGpsLocationCount(event: EventGpsFields): number {
  return getEventGpsLocations(event).length
}

export function getGpsLocationLabel(locationNumber: number, locationCount: number): string {
  if (locationCount <= 1) return '촬영 위치'
  return `${locationNumber}차 촬영 위치`
}

export function parseLocationNumber(value: unknown): GpsLocationNumber {
  const n = Number(value)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

/** 위치 개수만 표시 (순환 코스 표기 제거) */
export function getEventCourseLabel(locationCount: number): string {
  if (locationCount > 1) return `(${locationCount}개 위치)`
  return ''
}
