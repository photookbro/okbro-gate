/**
 * 비로그인(게스트) 접근 정책.
 * - 공개 페이지: 홈, 대회 목록만 열람/이동 가능
 * - 그 외 페이지: 미들웨어에서 /login 으로 리다이렉트
 * - 공개 페이지 안 기능 클릭은 GuestAuthGate 가 로그인 유도
 */

export function isGuestPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  if (pathname === '/' || pathname === '/home') return true
  if (pathname === '/events') return true
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return true
  if (pathname === '/diagnosis' || pathname.startsWith('/diagnosis/')) return true

  if (pathname === '/login' || pathname === '/signup') return true
  if (pathname.startsWith('/auth/')) return true

  return false
}

/** 클릭 가드를  altogether 끄는 페이지 (로그인/가입 플로우) */
export function isGuestClickExemptPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/')
  )
}

/** 게스트가 링크로 이동해도 되는 앱 경로 (/events/[id] 는 제외) */
export function isGuestNavigablePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (isGuestPublicPath(pathname)) return true
  return false
}
