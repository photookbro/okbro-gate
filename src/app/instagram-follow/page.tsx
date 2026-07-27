'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/supabase/auth-client'
import type { InstagramFollowBonusStatus } from '@/lib/instagram-follow-bonus'

function InstagramFollowContent() {
  const router = useRouter()
  const supabase = createClient()
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [status, setStatus] = useState<InstagramFollowBonusStatus | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        router.replace('/login?next=/instagram-follow')
        return
      }
      setAuthChecked(true)
    })
  }, [router, supabase.auth])

  useEffect(() => {
    if (!authChecked) return

    let cancelled = false
    setLoading(true)

    authFetch('/api/instagram-follow/status')
      .then(async res => {
        const data = await res.json()
        if (cancelled) return
        if (res.ok) {
          setStatus(data as InstagramFollowBonusStatus)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authChecked])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!handleInput.trim()) {
      setErrorMsg('인스타 아이디를 입력해주세요')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await authFetch('/api/instagram-follow/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagram_handle: handleInput.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(typeof data.error === 'string' ? data.error : '신청에 실패했어요')
        if (data.status) setStatus(data.status as InstagramFollowBonusStatus)
        return
      }

      setSuccessMsg(typeof data.message === 'string' ? data.message : '혜택이 적용됐어요')
      if (data.status) setStatus(data.status as InstagramFollowBonusStatus)
      setHandleInput('')
    } catch {
      setErrorMsg('요청 중 오류가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  if (!authChecked || loading) {
    return (
      <div className="page-shell flex min-h-[60vh] items-center justify-center">
        <p className="text-muted">로딩 중...</p>
      </div>
    )
  }

  const bonusDays = status?.bonus_days_setting ?? 5
  const canSubmit = status?.state === 'not_submitted' || status?.state === 'not_matched'

  return (
    <div className="page-shell">
      <div className="page-container">
        <Link href="/mypage" className="text-sm text-muted no-underline">
          ← MY PAGE
        </Link>

        <h1 className="page-title mt-3">인스타 팔로우 혜택</h1>

        {status?.state === 'active' ? (
          <div className="card mb-4">
            <p className="mb-2 text-center text-sm font-semibold text-success">
              이미 인증되었습니다
            </p>
            <p className="mb-2 text-center text-sm text-muted">무료 열람 기간</p>
            <p className="mypage-dday mypage-dday-success mb-2 text-center">
              D-{status.days_remaining ?? 0}
            </p>
            <p className="mb-0 text-center text-sm text-muted">
              @{status.instagram_handle}
              {status.period_label ? ` · ${status.period_label}` : ''}
            </p>
          </div>
        ) : null}

        {status?.state === 'expired' ? (
          <div className="card mb-4">
            <p className="mb-2 text-center text-sm font-semibold text-muted">혜택이 만료되었어요</p>
            <p className="mypage-dday mypage-dday-muted mb-2 text-center">만료됨</p>
            <p className="mb-0 text-center text-sm text-muted">
              {status.instagram_handle ? `@${status.instagram_handle}` : null}
              {status.period_label
                ? `${status.instagram_handle ? ' · ' : ''}${status.period_label}`
                : null}
            </p>
            <p className="mt-4 mb-0 text-center text-sm text-muted">
              인스타 팔로우 무료 열람은 1회만 적용돼요. 이후에는 과일 인증으로 열람할 수 있어요.
            </p>
          </div>
        ) : null}

        {canSubmit ? (
          <div className="card mb-4">
            <p className="mb-3 text-base leading-relaxed text-[var(--text)]">
              인스타그램(
              <span className="font-bold text-[#FF2800]">@photo_ok_bro</span>
              )을 팔로우하고 계신가요? 아이디를 알려주시면 가입일 포함 {bonusDays}일간 별도 인증
              없이 사진을 확인하실 수 있어요.
            </p>
            <p className="mb-4 text-sm text-muted">
              팔로워 목록은 매주 금요일 업데이트돼요. 방금 팔로우하셨다면 다음 금요일 이후 다시
              시도해주세요.
            </p>

            {status?.state === 'not_matched' ? (
              <p className="alert-warning mb-4">
                아직 팔로워 목록에서 확인되지 않았어요. 매주 금요일 업데이트되니 그 이후 다시
                시도해주세요.
              </p>
            ) : null}

            <form onSubmit={e => void handleSubmit(e)}>
              <label htmlFor="instagram-handle-input" className="label-field">
                인스타 아이디
              </label>
              <input
                id="instagram-handle-input"
                type="text"
                value={handleInput}
                onChange={e => setHandleInput(e.target.value)}
                placeholder="예: your_id"
                autoComplete="off"
                className={`input-field mb-3 ${errorMsg ? 'input-field-error' : ''}`}
              />

              {errorMsg ? <p className="alert-danger">{errorMsg}</p> : null}
              {successMsg ? <p className="alert-success">{successMsg}</p> : null}

              <button type="submit" disabled={submitting} className="btn-primary mt-3">
                {submitting ? '확인 중...' : '제출하기'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function InstagramFollowPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell flex min-h-[60vh] items-center justify-center">
          <p className="text-muted">로딩 중...</p>
        </div>
      }
    >
      <InstagramFollowContent />
    </Suspense>
  )
}
