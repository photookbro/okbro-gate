'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase/auth-client'
import type { InstagramFollowBonusStatus } from '@/lib/instagram-follow-bonus'

type InstagramFollowOnboardingModalProps = {
  open: boolean
  onComplete: () => void
  onSkip: () => void
}

type ModalPhase = 'question' | 'form'

export function InstagramFollowOnboardingModal({
  open,
  onComplete,
  onSkip,
}: InstagramFollowOnboardingModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('question')
  const [statusLoading, setStatusLoading] = useState(false)
  const [bonusDays, setBonusDays] = useState(5)
  const [handleInput, setHandleInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!open) {
      setPhase('question')
      setHandleInput('')
      setErrorMsg('')
      return
    }

    let cancelled = false
    setStatusLoading(true)

    authFetch('/api/instagram-follow/status')
      .then(async res => {
        const data = (await res.json()) as InstagramFollowBonusStatus
        if (cancelled) return

        if (res.ok && typeof data.bonus_days_setting === 'number') {
          setBonusDays(data.bonus_days_setting)
        }

        if (res.ok && data.state !== 'not_submitted') {
          onComplete()
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per open
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!handleInput.trim()) {
      setErrorMsg('인스타 아이디를 입력해주세요')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await authFetch('/api/instagram-follow/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_handle: handleInput.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(typeof data.error === 'string' ? data.error : '신청에 실패했어요')
        return
      }

      onComplete()
    } catch {
      setErrorMsg('요청 중 오류가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay z-[70]" onClick={onSkip}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="instagram-follow-onboarding-title"
      >
        {statusLoading ? (
          <p className="text-sm text-muted">확인 중...</p>
        ) : phase === 'question' ? (
          <>
            <h2 id="instagram-follow-onboarding-title" className="section-title">
              인스타그램 팔로워이신가요?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              @photo_ok_bro를 팔로우하고 계시면 확인된 아이디 등록 시 {bonusDays}일씩 열람 기간이
              늘어나요. 다른 아이디도 추가로 등록할 수 있어요. 매주 금요일 오후에 확인 후
              반영돼요.
            </p>
            <div className="btn-row">
              <button type="button" className="btn-secondary" onClick={onSkip}>
                아니요
              </button>
              <button type="button" className="btn-primary" onClick={() => setPhase('form')}>
                네, 팔로우 중이에요
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="instagram-follow-onboarding-title" className="section-title">
              인스타 아이디 입력
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              인스타그램 프로필에 보이는 아이디를 입력해주세요. 매주 금요일 오후에 확인 후
              반영돼요.
            </p>
            <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
              <input
                type="text"
                value={handleInput}
                onChange={e => {
                  setHandleInput(e.target.value)
                  setErrorMsg('')
                }}
                placeholder="예: your_id"
                autoComplete="off"
                className={`input-field w-full ${errorMsg ? 'input-field-error' : ''}`}
              />
              {errorMsg ? <p className="alert-danger text-sm">{errorMsg}</p> : null}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? '확인 중...' : '제출하기'}
              </button>
            </form>
            <button type="button" className="btn-secondary mt-3 w-full" onClick={onSkip}>
              나중에 할게요
            </button>
          </>
        )}
      </div>
    </div>
  )
}
