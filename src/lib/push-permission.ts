export type MobilePlatform = 'ios' | 'android' | 'other'

export const PUSH_SUBSCRIBE_BANNER_SESSION_DISMISS_KEY =
  'okbro_push_subscribe_banner_session_dismiss'
export const PUSH_DENIED_TIP_SESSION_DISMISS_KEY = 'okbro_push_denied_tip_session_dismiss'

export function detectMobilePlatform(userAgent: string): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

export function getNotificationSettingsGuide(platform: MobilePlatform): {
  title: string
  steps: string[]
} {
  if (platform === 'ios') {
    return {
      title: '브라우저 설정에서 알림을 허용해주세요',
      steps: [
        '주소창 왼쪽 자물쇠(또는 Aa) 아이콘을 눌러주세요',
        '웹사이트 설정 → 알림 → 허용',
        '또는 iPhone 설정 → Safari(또는 OKbroGATE 앱) → 알림 허용',
      ],
    }
  }

  if (platform === 'android') {
    return {
      title: '브라우저 설정에서 알림을 허용해주세요',
      steps: [
        '주소창 왼쪽 자물쇠 아이콘을 눌러주세요',
        '권한(또는 사이트 설정) → 알림 → 허용',
        '허용 후 앱을 새로고침하면 다시 구독할 수 있어요',
      ],
    }
  }

  return {
    title: '브라우저 설정에서 알림을 허용해주세요',
    steps: [
      '주소창 왼쪽 자물쇠 아이콘을 눌러주세요',
      '사이트 설정 → 알림 → 허용으로 바꿔주세요',
      '허용 후 페이지를 새로고침해주세요',
    ],
  }
}

export function isPushSubscribeBannerSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(PUSH_SUBSCRIBE_BANNER_SESSION_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPushSubscribeBannerForSession(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PUSH_SUBSCRIBE_BANNER_SESSION_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

export function isPushDeniedTipSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(PUSH_DENIED_TIP_SESSION_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPushDeniedTipForSession(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PUSH_DENIED_TIP_SESSION_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}
