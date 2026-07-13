import {
  queryGeolocationPermission,
  type GeolocationPermissionState,
} from '@/lib/geolocation-request'

export const PERMISSION_GPS_ACK_KEY = 'okbro_permission_gps_ack'
export const EVENT_DETAIL_PERMISSION_RECHECK_KEY = 'okbro_event_detail_permission_recheck_done'
export const ONBOARDING_VERIFICATION_SKIPPED_KEY = 'okbro_onboarding_verification_skipped'
export const PERMISSION_NOTIFICATION_ASKED_KEY = 'okbro_permission_notification_asked'

export type PermissionSnapshot = {
  gps: GeolocationPermissionState
}

export type StoredPermissionAck = {
  gps: boolean
}

export type MobilePlatform = 'ios' | 'android' | 'other'

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    if (value) {
      localStorage.setItem(key, '1')
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

export function getStoredPermissionAck(): StoredPermissionAck {
  return {
    gps: readFlag(PERMISSION_GPS_ACK_KEY),
  }
}

export function setPermissionAck(acknowledged: boolean) {
  writeFlag(PERMISSION_GPS_ACK_KEY, acknowledged)
}

export function syncPermissionAckFromSnapshot(snapshot: PermissionSnapshot) {
  if (snapshot.gps === 'granted') setPermissionAck(true)
}

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const gps = await queryGeolocationPermission()
  return { gps }
}

export function isGpsPermissionGranted(snapshot: PermissionSnapshot): boolean {
  return snapshot.gps === 'granted'
}

export function findPermissionGaps(
  snapshot: PermissionSnapshot,
  stored: StoredPermissionAck = getStoredPermissionAck()
): boolean {
  return stored.gps && !isGpsPermissionGranted(snapshot)
}

export function isEventDetailRecheckDone(): boolean {
  return readFlag(EVENT_DETAIL_PERMISSION_RECHECK_KEY)
}

export function markEventDetailRecheckDone() {
  writeFlag(EVENT_DETAIL_PERMISSION_RECHECK_KEY, true)
}

export function isOnboardingVerificationSkipped(): boolean {
  return readFlag(ONBOARDING_VERIFICATION_SKIPPED_KEY)
}

export function markOnboardingVerificationSkipped() {
  writeFlag(ONBOARDING_VERIFICATION_SKIPPED_KEY, true)
}

export function isNotificationPermissionAsked(): boolean {
  return readFlag(PERMISSION_NOTIFICATION_ASKED_KEY)
}

export function markNotificationPermissionAsked() {
  writeFlag(PERMISSION_NOTIFICATION_ASKED_KEY, true)
}

export function detectPlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export function getGeolocationSettingsGuide(platform: MobilePlatform): {
  title: string
  steps: string[]
} {
  if (platform === 'ios') {
    return {
      title: 'iOS 위치 권한 설정',
      steps: [
        'iPhone 설정 앱을 열어주세요',
        '개인정보 보호 및 보안 → 위치 서비스',
        'Safari 또는 OKbroGATE 앱 → 위치 허용',
        '「앱을 사용하는 동안」또는「정확한 위치」를 켜주세요',
      ],
    }
  }

  if (platform === 'android') {
    return {
      title: 'Android 위치 권한 설정',
      steps: [
        '설정 앱을 열어주세요',
        '앱 → Chrome (또는 OKbroGATE)',
        '권한 → 위치 → 허용',
        '「정확한 위치」를 켜주세요',
      ],
    }
  }

  return {
    title: '브라우저 위치 권한 설정',
    steps: [
      '주소창 왼쪽 자물쇠(사이트 정보) 아이콘을 눌러주세요',
      '위치 권한을「허용」으로 변경해주세요',
      '「정확한 위치」가 있으면 켜주세요',
    ],
  }
}

export const BACKGROUND_GPS_UNSUPPORTED_MESSAGE =
  '이 앱은 백그라운드 GPS를 지원하지 않아요. 앱을 완전히 종료하면 위치 추적이 멈춥니다. 화면만 꺼진 상태는 괜찮아요.'
