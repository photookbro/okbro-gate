export const PRECISE_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
}

export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported'

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported'
  }

  if (!('permissions' in navigator)) {
    return 'prompt'
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    return 'prompt'
  } catch {
    return 'prompt'
  }
}

export type GeolocationRequestResult = {
  granted: boolean
  reason?: 'unsupported' | 'denied' | 'timeout' | 'unavailable'
}

export async function requestPreciseGeolocation(): Promise<GeolocationRequestResult> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return { granted: false, reason: 'unsupported' }
  }

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ granted: true }),
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ granted: false, reason: 'denied' })
          return
        }
        if (error.code === error.TIMEOUT) {
          resolve({ granted: false, reason: 'timeout' })
          return
        }
        resolve({ granted: false, reason: 'unavailable' })
      },
      PRECISE_GEOLOCATION_OPTIONS
    )
  })
}

export const GPS_PERMISSION_REQUIRED_MESSAGE =
  '위치 권한이 필요해요. 정확한 위치를 허용해주세요.'

export const GPS_DETECTION_FAILURE_MESSAGE =
  '위치 감지가 안 됩니다. 폰 설정에서 위치(GPS 사용)을 켜세요'

export function geolocationFailureMessage(
  reason: GeolocationRequestResult['reason']
): string {
  switch (reason) {
    case 'unsupported':
      return '이 브라우저는 위치 서비스를 지원하지 않아요.'
    case 'denied':
      return GPS_PERMISSION_REQUIRED_MESSAGE
    case 'timeout':
    case 'unavailable':
    default:
      return GPS_DETECTION_FAILURE_MESSAGE
  }
}
