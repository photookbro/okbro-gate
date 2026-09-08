export type MobilePlatform = 'ios' | 'android' | 'other'

/** 「나중에」→ 영구 닫기 (마이페이지에서 다시 켤 수 있음) */
export const PUSH_SUBSCRIBE_BANNER_DISMISS_KEY = 'okbro_push_subscribe_banner_dismissed'
/** 배너 노출 횟수 (미구독·미닫기 시 최대 PUSH_SUBSCRIBE_BANNER_MAX_SHOWS회) */
export const PUSH_SUBSCRIBE_BANNER_SHOWN_COUNT_KEY = 'okbro_push_subscribe_banner_shown_count'
export const PUSH_SUBSCRIBE_BANNER_MAX_SHOWS = 2
/** 같은 세션에서 노출 카운트 중복 증가 방지 */
const PUSH_SUBSCRIBE_BANNER_SESSION_COUNTED_KEY =
  'okbro_push_subscribe_banner_session_counted'

export const PUSH_DENIED_TIP_SESSION_DISMISS_KEY = 'okbro_push_denied_tip_session_dismiss'

/** @deprecated session dismiss — 영구 dismiss로 대체됨 */
export const PUSH_SUBSCRIBE_BANNER_SESSION_DISMISS_KEY =
  'okbro_push_subscribe_banner_session_dismiss'

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

export function isPushSubscribeBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PUSH_SUBSCRIBE_BANNER_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissPushSubscribeBanner(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PUSH_SUBSCRIBE_BANNER_DISMISS_KEY, '1')
  } catch {
    // ignore
  }
}

function getPushSubscribeBannerShownCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = localStorage.getItem(PUSH_SUBSCRIBE_BANNER_SHOWN_COUNT_KEY)
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** 이번 세션에서 배너를 실제로 띄울 때 1회만 카운트 증가 */
export function recordPushSubscribeBannerImpression(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(PUSH_SUBSCRIBE_BANNER_SESSION_COUNTED_KEY) === '1') return
    sessionStorage.setItem(PUSH_SUBSCRIBE_BANNER_SESSION_COUNTED_KEY, '1')
    const next = getPushSubscribeBannerShownCount() + 1
    localStorage.setItem(PUSH_SUBSCRIBE_BANNER_SHOWN_COUNT_KEY, String(next))
  } catch {
    // ignore
  }
}

/** 미구독 + 미닫기 + 노출 한도 미만일 때만 true */
export function shouldShowPushSubscribeBanner(): boolean {
  if (typeof window === 'undefined') return false
  if (isPushSubscribeBannerDismissed()) return false
  return getPushSubscribeBannerShownCount() < PUSH_SUBSCRIBE_BANNER_MAX_SHOWS
}

/** @deprecated use isPushSubscribeBannerDismissed */
export function isPushSubscribeBannerSessionDismissed(): boolean {
  return isPushSubscribeBannerDismissed()
}

/** @deprecated use dismissPushSubscribeBanner */
export function dismissPushSubscribeBannerForSession(): void {
  dismissPushSubscribeBanner()
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
