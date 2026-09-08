import { authFetch } from '@/lib/supabase/auth-client'

export const TERMS_AGREED_KEY = 'terms_agreed_v1'
export const TERMS_VERSION = 'v1'

/** 짧은 서버 조회 캐시 (탭 세션) — Active CPU용 */
const TERMS_STATUS_CACHE_KEY = 'okbro_terms_status_cache_v1'
const TERMS_STATUS_CACHE_TTL_MS = 120_000

type TermsStatusCache = {
  agreed: boolean
  checkedAt: number
}

export function hasTermsAgreed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TERMS_AGREED_KEY) === 'true'
}

export function setTermsAgreed(): void {
  localStorage.setItem(TERMS_AGREED_KEY, 'true')
}

export function clearLocalTermsAgreed(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TERMS_AGREED_KEY)
  clearTermsStatusCache()
}

function readTermsStatusCache(): TermsStatusCache | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(TERMS_STATUS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TermsStatusCache
    if (typeof parsed?.agreed !== 'boolean' || typeof parsed?.checkedAt !== 'number') {
      return null
    }
    if (Date.now() - parsed.checkedAt > TERMS_STATUS_CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeTermsStatusCache(agreed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    const payload: TermsStatusCache = { agreed, checkedAt: Date.now() }
    sessionStorage.setItem(TERMS_STATUS_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function clearTermsStatusCache(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(TERMS_STATUS_CACHE_KEY)
  } catch {
    // ignore
  }
}

/** 계정(DB) 동의 여부. 조회 실패 시 agreed=false (닫힌 게이트). */
export async function fetchTermsAgreementStatus(): Promise<{
  agreed: boolean
  error?: string
}> {
  const cached = readTermsStatusCache()
  if (cached) {
    return { agreed: cached.agreed }
  }

  try {
    const res = await authFetch('/api/terms-agree')
    const data = await res.json().catch(() => ({}))

    if (res.status === 401) {
      return { agreed: false, error: '로그인이 필요해요' }
    }

    if (!res.ok) {
      return { agreed: false, error: typeof data.error === 'string' ? data.error : '동의 기록 조회 실패' }
    }

    const agreed = data.agreed === true
    writeTermsStatusCache(agreed)
    return { agreed }
  } catch {
    return { agreed: false, error: '동의 기록 조회 실패' }
  }
}

export async function saveTermsAgreement(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authFetch('/api/terms-agree', { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? '동의 기록 저장 실패' }
    }

    setTermsAgreed()
    writeTermsStatusCache(true)
    return { success: true }
  } catch {
    return { success: false, error: '요청 중 오류가 발생했어요' }
  }
}
