export const SEOUL_CENTER = {
  lat: 37.5665,
  lng: 126.978,
} as const

export const DEFAULT_MAP_ZOOM = 15

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
