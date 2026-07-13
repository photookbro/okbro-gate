'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NAVER_ORDER_PLACEHOLDER } from '@/lib/naver-order-number'
import { markOnboardingVerificationSkipped } from '@/lib/app-permissions'

type VerificationModalProps = {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

export function VerificationModal({ open, onComplete, onSkip }: VerificationModalProps) {
  const [orderInput, setOrderInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setAuthChecked(true)
    })
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderInput.trim()) {
      setErrorMsg('주문번호를 입력해주세요')
      return
    }
    if (!userId) {
      setErrorMsg('로그인이 필요해요. 나중에 마이페이지에서 인증할 수 있어요')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await fetch('/api/verify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: orderInput.trim(),
          platform: 'naver',
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? '인증에 실패했어요')
        return
      }

      setOrderInput('')
      onComplete()
    } catch {
      setErrorMsg('인증 중 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    markOnboardingVerificationSkipped()
    onSkip()
  }

  return (
    <div className="modal-overlay z-[70]">
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="verification-onboarding-title"
      >
        <h2 id="verification-onboarding-title" className="section-title">
          🎫 인증번호 입력 (선택)
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          네이버 구매 주문번호를 입력하면 고화질 사진 열람 기간이 연결돼요. 지금
          건너뛰어도 나중에 마이페이지에서 입력할 수 있어요.
        </p>

        {!authChecked ? (
          <p className="text-sm text-muted">확인 중...</p>
        ) : !userId ? (
          <p className="alert-warning mb-4 text-sm">
            로그인하지 않은 상태예요. 인증은 로그인 후 마이페이지에서 할 수 있어요.
          </p>
        ) : (
          <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                주문번호
              </span>
              <input
                type="text"
                value={orderInput}
                onChange={e => {
                  setOrderInput(e.target.value)
                  setErrorMsg('')
                }}
                placeholder={NAVER_ORDER_PLACEHOLDER}
                className="input-field w-full"
                autoComplete="off"
              />
            </label>
            {errorMsg ? <p className="alert-danger text-sm">{errorMsg}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? '인증 중...' : '인증하기'}
            </button>
          </form>
        )}

        <button type="button" className="btn-secondary mt-3 w-full" onClick={handleSkip}>
          나중에 할게요
        </button>
      </div>
    </div>
  )
}
