import { isGuestNavigablePath } from '@/lib/guest-routes'

/** 대박과수원(네이버 스마트스토어) — 비로그인에서도 이동 허용 */
export const FRUIT_STORE_URL = 'https://smartstore.naver.com/daebakfresh'

export function isFruitStoreUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://okbro.local')
    return (
      url.hostname === 'smartstore.naver.com' &&
      (url.pathname === '/daebakfresh' || url.pathname.startsWith('/daebakfresh/'))
    )
  } catch {
    return href.includes('smartstore.naver.com/daebakfresh')
  }
}

/** 비로그인에서도 클릭 가능한 링크 (스토어·로그인·홈·대회 목록) */
export function isGuestAllowedHref(href: string): boolean {
  const trimmed = href.trim()
  if (!trimmed || trimmed === '#') return false
  if (isFruitStoreUrl(trimmed)) return true

  if (
    trimmed.startsWith('/login') ||
    trimmed.startsWith('/signup') ||
    trimmed.startsWith('/auth/')
  ) {
    return true
  }

  // 홈 / 대회 목록 메뉴 이동 허용 (exact /events 만)
  if (trimmed === '/' || trimmed === '/home' || trimmed === '/events') {
    return true
  }
  if (trimmed.startsWith('/home?') || trimmed.startsWith('/events?')) {
    return true
  }

  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://okbro.local'
    const url = new URL(trimmed, base)
    const sameOrigin =
      typeof window === 'undefined'
        ? url.origin === 'https://okbro.local'
        : url.origin === window.location.origin || url.origin === 'https://okbro.local'
    if (sameOrigin) {
      return isGuestNavigablePath(url.pathname)
    }
  } catch {
    // ignore invalid href
  }

  return false
}
