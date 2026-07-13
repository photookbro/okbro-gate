export const SEOUL_CENTER = {
  lat: 37.5665,
  lng: 126.978,
} as const

/** 줌 15는 픽셀당 지상거리가 커서 클릭 오차가 수십 m까지 남을 수 있음 — 건물 단위로 보이는 18로 고정 */
export const DEFAULT_MAP_ZOOM = 18

export type MapCenter = {
  lat: number
  lng: number
}

export function parseCoordinate(value: string): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export function formatCoordinate(value: number): string {
  return value.toFixed(6)
}

export function hasValidCoordinates(lat: string, lng: string): boolean {
  return parseCoordinate(lat) != null && parseCoordinate(lng) != null
}

export function resolveMapCenter(lat: string, lng: string): MapCenter {
  const parsedLat = parseCoordinate(lat)
  const parsedLng = parseCoordinate(lng)

  if (parsedLat != null && parsedLng != null) {
    return { lat: parsedLat, lng: parsedLng }
  }

  return { lat: SEOUL_CENTER.lat, lng: SEOUL_CENTER.lng }
}

export function defaultMapCenterStrings(): { lat: string; lng: string } {
  return {
    lat: formatCoordinate(SEOUL_CENTER.lat),
    lng: formatCoordinate(SEOUL_CENTER.lng),
  }
}
