export type InAppBrowserType =
  | 'kakaotalk'
  | 'instagram'
  | 'naver'
  | 'line'
  | 'facebook'
  | 'other'
  | null

const IN_APP_UA_PATTERN =
  /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(|Snapchat|Twitter|EveryTime|Whale/i

export function detectInAppBrowser(): InAppBrowserType {
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent || navigator.vendor || ''

  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/NAVER\(/i.test(ua)) return 'naver'
  if (/Line\//i.test(ua)) return 'line'
  if (/FBAN|FBAV/i.test(ua)) return 'facebook'
  if (IN_APP_UA_PATTERN.test(ua)) return 'other'

  return null
}

export function isInAppBrowser(): boolean {
  return detectInAppBrowser() !== null
}

export function getExternalBrowserInstructions(): string {
  const type = detectInAppBrowser()

  switch (type) {
    case 'kakaotalk':
      return '카카오톡: 우측 하단 ... → 브라우저로 열기'
    case 'instagram':
      return '인스타그램: 우측 하단 ... → 외부 브라우저로 열기'
    case 'naver':
    case 'line':
    case 'facebook':
    case 'other':
      return '주소를 복사해서 Chrome 또는 Safari에서 열기'
    default: {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      return isIOS
        ? '우측 상단 ··· 메뉴에서 "Safari에서 열기"를 선택해주세요.'
        : '우측 상단 메뉴에서 "다른 브라우저로 열기" 또는 Chrome을 선택해주세요.'
    }
  }
}

export async function copyCurrentPageUrl(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}

export async function openInExternalBrowser(): Promise<void> {
  const url = window.location.href
  const ua = navigator.userAgent

  if (/android/i.test(ua)) {
    const stripped = url.replace(/^https?:\/\//, '')
    const intent = `intent://${stripped}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.android.chrome;end`
    window.location.href = intent
    return
  }

  const copied = await copyCurrentPageUrl()
  if (copied) {
    alert(`링크를 복사했어요.\n${getExternalBrowserInstructions()}`)
  } else {
    window.prompt('아래 주소를 복사해서 Safari 또는 Chrome에서 열어주세요:', url)
  }
}
