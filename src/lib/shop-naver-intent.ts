/** Android + 네이버 쇼핑 링크 → 네이버 앱 Intent URL */

const NAVER_HOST_RE =
  /(^|\.)naver\.com$/i

const NAVER_ME_HOST_RE = /^naver\.me$/i

export function isAndroidUserAgent(userAgent: string): boolean {
  return /android/i.test(userAgent)
}

export function isNaverShoppingUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    const host = hostname.toLowerCase()
    return NAVER_ME_HOST_RE.test(host) || NAVER_HOST_RE.test(host)
  } catch {
    return false
  }
}

/**
 * https://smartstore.naver.com/foo →
 * intent://smartstore.naver.com/foo#Intent;scheme=https;package=com.nhn.android.search;S.browser_fallback_url=...;end
 */
export function buildNaverAppIntentUrl(affiliateUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(affiliateUrl)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const pathWithoutScheme = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
  const fallback = encodeURIComponent(affiliateUrl)

  return (
    `intent://${pathWithoutScheme}` +
    `#Intent;scheme=https;package=com.nhn.android.search;` +
    `S.browser_fallback_url=${fallback};end`
  )
}

export function resolveShopBuyHref(
  affiliateUrl: string,
  userAgent: string
): { href: string; sameWindow: boolean } {
  if (isAndroidUserAgent(userAgent) && isNaverShoppingUrl(affiliateUrl)) {
    const intentUrl = buildNaverAppIntentUrl(affiliateUrl)
    if (intentUrl) {
      return { href: intentUrl, sameWindow: true }
    }
  }
  return { href: affiliateUrl, sameWindow: false }
}
