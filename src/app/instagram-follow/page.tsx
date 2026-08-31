'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_LATE_MATCH_NOTICE,
  instagramFollowSubmitCompleteMessage,
} from '@/lib/instagram-follow-copy'
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

      setSuccessMsg(
        typeof data.message === 'string' ? data.message : instagramFollowSubmitCompleteMessage()
      )
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
  const showClaimForm = !!status

  return (
    <div className="page-shell">
      <div className="page-container">
        <Link href="/mypage" className="text-sm text-muted no-underline">
          ← MY PAGE
        </Link>

        <h1 className="page-title mt-3">인스타 팔로우 혜택</h1>

        <p className="mb-4 text-sm font-medium text-[var(--text)]">
          팔로워로 확인된 아이디를 등록하면 {bonusDays}일씩 열람 기간이 늘어나요. 다른 아이디도
          추가로 쓸 수 있어요. (같은 아이디는 중복 불가)
        </p>

        {status?.state === 'active' ? (
          <div className="card mb-4">
            <p className="mb-2 text-center text-sm font-semibold text-success">
              혜택 적용 중
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
              다른 팔로우 아이디로 다시 등록하면 {bonusDays}일 혜택을 받을 수 있어요.
            </p>
          </div>
        ) : null}

        {showClaimForm ? (
          <div className="card mb-4">
            <p className="mb-3 text-base leading-relaxed text-[var(--text)]">
              인스타그램(
              <span className="font-bold text-[#FF2800]">@{INSTAGRAM_HANDLE}</span>
              )을 팔로우하고 계신가요? 확인된 아이디를 알려주시면 등록할 때마다 {bonusDays}일씩
              열람 기간이 늘어나요.
            </p>
            <p className="mb-4 text-sm text-muted">
              인스타그램 팔로우는 {INSTAGRAM_LATE_MATCH_NOTICE}. 팔로우 즉시 바로 되는 게 아니니
              참고해주세요.
            </p>

            {status?.state === 'pending' ? (
              <p className="alert-success mb-4">{instagramFollowSubmitCompleteMessage()}</p>
            ) : null}

            {status?.state === 'not_matched' ? (
              <p className="alert-warning mb-4">
                아직 확인되지 않았어요. 매주 금요일 오후에 확인 후 반영되니, 그 이후 다시
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
