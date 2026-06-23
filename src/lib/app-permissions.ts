import {
  queryGeolocationPermission,
  type GeolocationPermissionState,
} from '@/lib/geolocation-request'
import { detectMobilePlatform, type MobilePlatform } from '@/lib/push-permission'

export const PERMISSION_GPS_ACK_KEY = 'okbro_permission_gps_ack'
export const PERMISSION_NOTIFICATION_ACK_KEY = 'okbro_permission_notification_ack'
export const EVENT_DETAIL_PERMISSION_RECHECK_KEY = 'okbro_event_detail_permission_recheck_done'
export const ONBOARDING_VERIFICATION_SKIPPED_KEY = 'okbro_onboarding_verification_skipped'

export type PermissionKind = 'gps' | 'notification'

export type PermissionSnapshot = {
  gps: GeolocationPermissionState
  notification: 'granted' | 'denied' | 'default' | 'unsupported'
}

export type StoredPermissionAck = {
  gps: boolean
  notification: boolean
}

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
    notification: readFlag(PERMISSION_NOTIFICATION_ACK_KEY),
  }
}

export function setPermissionAck(kind: PermissionKind, acknowledged: boolean) {
  writeFlag(
    kind === 'gps' ? PERMISSION_GPS_ACK_KEY : PERMISSION_NOTIFICATION_ACK_KEY,
    acknowledged
  )
}

export function syncPermissionAckFromSnapshot(snapshot: PermissionSnapshot) {
  if (snapshot.gps === 'granted') setPermissionAck('gps', true)
  if (snapshot.notification === 'granted') setPermissionAck('notification', true)
}

export async function getPermissionSnapshot(): Promise<PermissionSnapshot> {
  const gps = await queryGeolocationPermission()
  let notification: PermissionSnapshot['notification'] = 'unsupported'

  if (typeof window !== 'undefined' && 'Notification' in window) {
    notification = Notification.permission
  }

  return { gps, notification }
}

export function isPermissionGranted(
  snapshot: PermissionSnapshot,
  kind: PermissionKind
): boolean {
  if (kind === 'gps') return snapshot.gps === 'granted'
  return snapshot.notification === 'granted'
}

/** 저장된 ack와 실제 권한을 비교해 부족한 항목 반환 */
export function findPermissionGaps(
  snapshot: PermissionSnapshot,
  stored: StoredPermissionAck = getStoredPermissionAck()
): PermissionKind[] {
  const gaps: PermissionKind[] = []

  if (stored.gps && !isPermissionGranted(snapshot, 'gps')) {
    gaps.push('gps')
  }
  if (stored.notification && !isPermissionGranted(snapshot, 'notification')) {
    gaps.push('notification')
  }

  return gaps
}

/** 대회 상세에서 필요한 권한이 실제로 없는지 (ack 여부와 무관) */
export function findMissingRuntimePermissions(snapshot: PermissionSnapshot): PermissionKind[] {
  const missing: PermissionKind[] = []
  if (!isPermissionGranted(snapshot, 'gps')) missing.push('gps')
  if (!isPermissionGranted(snapshot, 'notification')) missing.push('notification')
  return missing
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

export function detectPlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return 'other'
  return detectMobilePlatform(navigator.userAgent)
}

export const BACKGROUND_GPS_UNSUPPORTED_MESSAGE =
  '이 앱은 백그라운드 GPS를 지원하지 않아요. 앱을 완전히 종료하면 위치 추적이 멈춥니다. 화면만 꺼진 상태는 괜찮아요.'
