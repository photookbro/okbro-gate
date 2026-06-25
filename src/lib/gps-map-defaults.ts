export const SEOUL_CENTER = {
  lat: 37.5665,
  lng: 126.978,
} as const

export const DEFAULT_MAP_ZOOM = 15

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
