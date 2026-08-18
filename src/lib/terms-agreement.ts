import { authFetch } from '@/lib/supabase/auth-client'

export const TERMS_AGREED_KEY = 'terms_agreed_v1'
export const TERMS_VERSION = 'v1'

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
}

/** 계정(DB) 동의 여부. 조회 실패 시 agreed=false (닫힌 게이트). */
export async function fetchTermsAgreementStatus(): Promise<{
  agreed: boolean
  error?: string
}> {
  try {
    const res = await authFetch('/api/terms-agree')
    const data = await res.json().catch(() => ({}))

    if (res.status === 401) {
      return { agreed: false, error: '로그인이 필요해요' }
    }

    if (!res.ok) {
      return { agreed: false, error: typeof data.error === 'string' ? data.error : '동의 기록 조회 실패' }
    }

    return { agreed: data.agreed === true }
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
    return { success: true }
  } catch {
    return { success: false, error: '요청 중 오류가 발생했어요' }
  }
}
