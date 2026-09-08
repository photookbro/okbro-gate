'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { InstagramFollowBonusStatus } from '@/lib/instagram-follow-bonus'
import {
  INSTAGRAM_FOLLOW_MYPAGE_WARNING,
  INSTAGRAM_LATE_MATCH_NOTICE,
  instagramFollowMypageDescriptionLead,
  instagramFollowMypageDescriptionTail,
  instagramFollowSubmitCompleteMessage,
  instagramOwnAccountClaimBlockedMessage,
} from '@/lib/instagram-follow-copy'
import { isBrandOwnInstagramHandle } from '@/lib/instagram-handle'
import { authFetch } from '@/lib/supabase/auth-client'

type PhotoAccess = {
  purchase_days_remaining: number
  photo_access_days_remaining: number
  purchase_validity_label: string
  status: 'valid' | 'expired' | 'none'
  expiring_soon: boolean
}

type MypageAlbumAccessStatusProps = {
  photoAccess: PhotoAccess | null
  instagramFollowBonus: InstagramFollowBonusStatus | null
  onInstagramFollowBonusChange?: (status: InstagramFollowBonusStatus) => void
}

function formatPhotoAccessDday(daysRemaining: number, status: string): string {
  if (status === 'none' || status === 'expired' || daysRemaining <= 0) return '만료됨'
  if (daysRemaining === 0) return 'D-Day'
  return `D-${daysRemaining}`
}

function ddayClass(status: string, expiringSoon: boolean): string {
  if (status === 'none' || status === 'expired') return 'mypage-dday mypage-dday-muted'
  if (expiringSoon) return 'mypage-dday mypage-dday-danger'
  return 'mypage-dday mypage-dday-success'
}

function FruitAccessRow({ photoAccess }: { photoAccess: PhotoAccess | null }) {
  const status = photoAccess?.status ?? 'none'
  const daysRemaining = photoAccess?.purchase_days_remaining ?? 0
  const validityLabel = photoAccess?.purchase_validity_label ?? '-'
  const isExpiringSoon = photoAccess?.expiring_soon ?? false
  const hasAccess = status === 'valid' && daysRemaining > 0
  const isExpired = status === 'expired'

  return (
    <div className="mypage-access-row">
      <p className="mypage-access-row-label">과일 인증 열람일</p>

      {status === 'none' ? (
        <div className="text-center">
          <p className="mypage-dday mypage-dday-muted mb-0">인증 없음</p>
        </div>
      ) : (
        <div className="text-center">
          <p className={ddayClass(status, isExpiringSoon)}>
            {formatPhotoAccessDday(daysRemaining, status)}
          </p>
          <p className="mypage-status-sub">
            {hasAccess
              ? validityLabel && validityLabel !== '-'
                ? validityLabel
                : `사진 열람 가능: ${daysRemaining}일`
              : '사진 열람 가능: 0일'}
          </p>

          {isExpiringSoon && hasAccess ? (
            <div className="alert-warning mt-4 mb-0">⚠️ 곧 만료</div>
          ) : null}

          {isExpired ? (
            <div className="alert-danger mt-4 mb-0">
              ❌ 만료됨. 주문번호로 다시 인증해주세요
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function FollowerAccessRow({
  instagramFollowBonus,
  onInstagramFollowBonusChange,
}: {
  instagramFollowBonus: InstagramFollowBonusStatus | null
  onInstagramFollowBonusChange?: (status: InstagramFollowBonusStatus) => void
}) {
  const [editing, setEditing] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!instagramFollowBonus) return null

  const { state, bonus_days_setting, days_remaining, period_label, instagram_handle } =
    instagramFollowBonus

  if (state === 'expired') {
    return (
      <div className="mypage-access-row">
        <p className="mypage-access-row-label">팔로워 인증 열람일</p>
        <p className="mypage-access-caption-muted mb-0">
          팔로워 인증 열람 기간은 종료되었어요
        </p>
      </div>
    )
  }

  if (state === 'active') {
    return (
      <div className="mypage-access-row">
        <p className="mypage-access-row-label">팔로워 인증 열람일</p>
        <div className="text-center">
          <p className="mb-2 text-sm text-muted">무료 열람 기간</p>
          <p className="mypage-dday mypage-dday-success mb-2">D-{days_remaining ?? 0}</p>
          <p className="mb-0 text-sm text-muted">
            @{instagram_handle}
            {period_label ? ` · ${period_label}` : ''}
          </p>
        </div>
      </div>
    )
  }

  const descriptionLead = instagramFollowMypageDescriptionLead(bonus_days_setting)
  const descriptionTail = instagramFollowMypageDescriptionTail()

  function renderFollowDescription() {
    return (
      <div className="mb-3 space-y-2 text-sm leading-relaxed">
        <p className="mb-0 whitespace-pre-line text-muted">{descriptionLead}</p>
        <p className="mypage-instagram-follow-warning mb-0">{INSTAGRAM_FOLLOW_MYPAGE_WARNING}</p>
        <p className="mb-0 text-muted">{descriptionTail}</p>
      </div>
    )
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!handleInput.trim()) {
      setErrorMsg('인스타 아이디를 입력해주세요')
      return
    }
    if (isBrandOwnInstagramHandle(handleInput)) {
      setErrorMsg(instagramOwnAccountClaimBlockedMessage())
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
        return
      }

      if (data.status) {
        onInstagramFollowBonusChange?.(data.status as InstagramFollowBonusStatus)
      }
      setSuccessMsg(
        typeof data.message === 'string' ? data.message : instagramFollowSubmitCompleteMessage()
      )
      setEditing(false)
      setHandleInput('')
    } catch {
      setErrorMsg('요청 중 오류가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'pending') {
    return (
      <div className="mypage-access-row">
        <p className="mypage-access-row-label">팔로워 인증 열람일</p>
        {renderFollowDescription()}
        <p className="mb-1 text-sm text-muted">
          제출한 아이디: @{instagram_handle ?? '—'} (대기중)
        </p>
        {!editing ? (
          <button
            type="button"
            className="mb-0 text-sm text-muted underline"
            onClick={() => {
              setEditing(true)
              setHandleInput(instagram_handle ?? '')
              setErrorMsg('')
              setSuccessMsg('')
            }}
          >
            수정하기
          </button>
        ) : (
          <form onSubmit={e => void handleResubmit(e)} className="mt-3">
            <label htmlFor="mypage-instagram-handle-edit" className="label-field">
              인스타 아이디
            </label>
            <input
              id="mypage-instagram-handle-edit"
              type="text"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value)}
              placeholder="예: your_id"
              autoComplete="off"
              className={`input-field mb-3 ${errorMsg ? 'input-field-error' : ''}`}
            />
            {errorMsg ? <p className="alert-danger">{errorMsg}</p> : null}
            <div className="btn-row">
              <button
                type="button"
                className="btn-secondary"
                disabled={submitting}
                onClick={() => {
                  setEditing(false)
                  setErrorMsg('')
                }}
              >
                취소
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? '확인 중...' : '다시 제출하기'}
              </button>
            </div>
          </form>
        )}
        {successMsg ? <p className="alert-success mt-3 mb-0">{successMsg}</p> : null}
      </div>
    )
  }

  return (
    <div className="mypage-access-row">
      <p className="mypage-access-row-label">팔로워 인증 열람일</p>
      {renderFollowDescription()}
      {state === 'not_matched' ? (
        <p className="alert-warning mb-4">
          아직 확인되지 않았어요. {INSTAGRAM_LATE_MATCH_NOTICE} 그 이후 다시 시도해주세요.
        </p>
      ) : null}
      <Link href="/instagram-follow" className="btn-primary-inline inline-flex no-underline">
        팔로워 인증하고 무료로 열람하기
      </Link>
    </div>
  )
}

export function MypageAlbumAccessStatus({
  photoAccess,
  instagramFollowBonus,
  onInstagramFollowBonusChange,
}: MypageAlbumAccessStatusProps) {
  return (
    <div className="card mb-4 mypage-status-card">
      <h2 className="section-title">앨범 열람 현황</h2>
      <div className="mypage-access-rows">
        <FruitAccessRow photoAccess={photoAccess} />
        <FollowerAccessRow
          instagramFollowBonus={instagramFollowBonus}
          onInstagramFollowBonusChange={onInstagramFollowBonusChange}
        />
      </div>
    </div>
  )
}
