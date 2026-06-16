export const PUSH_PROMPT_DISMISSED_KEY = 'okbro_push_prompt_dismissed'

export type MobilePlatform = 'ios' | 'android' | 'other'

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
      title: 'iOS 알림 설정',
      steps: [
        'iPhone 설정 앱을 열어주세요',
        '알림 → Safari (또는 홈 화면에 추가한 오켱 앱)',
        '알림 허용을 켜주세요',
      ],
    }
  }

  if (platform === 'android') {
    return {
      title: 'Android 알림 설정',
      steps: [
        '설정 앱을 열어주세요',
        '앱 → Chrome (또는 사용 중인 브라우저)',
        '알림 → 허용',
      ],
    }
  }

  return {
    title: '브라우저 알림 설정',
    steps: [
      '브라우저 주소창 왼쪽 자물쇠(또는 사이트 정보) 아이콘을 눌러주세요',
      '알림/Notifications 항목을 찾아 허용으로 변경해주세요',
    ],
  }
}

export function isPushPromptDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === '1'
  } catch {
    return true
  }
}

export function dismissPushPrompt(): void {
  try {
    localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1')
  } catch {
    // ignore
  }
}

export function shouldShowPushPrompt(): boolean {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  if (Notification.permission === 'granted') return false
  return !isPushPromptDismissed()
}
