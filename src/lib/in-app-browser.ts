const IN_APP_UA_PATTERN =
  /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(|Snapchat|Twitter|EveryTime|Whale|GSA\/|SamsungBrowser\/[\d.]+.*Version/i

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || navigator.vendor || ''
  return IN_APP_UA_PATTERN.test(ua)
}

export function getExternalBrowserInstructions(): string {
  if (typeof navigator === 'undefined') return 'Safari 또는 Chrome 브라우저로 열어주세요.'

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (isIOS) {
    return '우측 상단 ··· 메뉴에서 "Safari에서 열기"를 선택해주세요.'
  }
  return '우측 상단 메뉴에서 "다른 브라우저로 열기" 또는 Chrome을 선택해주세요.'
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

  try {
    await navigator.clipboard.writeText(url)
    alert(`링크를 복사했어요.\n${getExternalBrowserInstructions()}`)
  } catch {
    window.prompt('아래 주소를 복사해서 Safari 또는 Chrome에서 열어주세요:', url)
  }
}
