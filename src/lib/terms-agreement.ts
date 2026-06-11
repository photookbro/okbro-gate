export const TERMS_AGREED_KEY = 'terms_agreed_v1'
export const TERMS_VERSION = 'v1'

export function hasTermsAgreed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TERMS_AGREED_KEY) === 'true'
}

export function setTermsAgreed(): void {
  localStorage.setItem(TERMS_AGREED_KEY, 'true')
}

export async function saveTermsAgreement(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/terms-agree', { method: 'POST' })
    const data = await res.json()

    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? '동의 기록 저장 실패' }
    }

    setTermsAgreed()
    return { success: true }
  } catch {
    return { success: false, error: '요청 중 오류가 발생했어요' }
  }
}
