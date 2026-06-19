export const PRECISE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
}

export async function requestPreciseGeolocation(): Promise<boolean> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return false
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      PRECISE_GEOLOCATION_OPTIONS
    )
  })
}
