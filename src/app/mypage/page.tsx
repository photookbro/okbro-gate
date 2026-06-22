'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NAVER_ORDER_PLACEHOLDER } from '@/lib/naver-order-number'

type PhotoAccess = {
  hipass_days_remaining: number
  purchase_days_remaining: number
  photo_access_days_remaining: number
  hipass_validity_label: string
  purchase_validity_label: string
  status: 'valid' | 'expired' | 'none'
  expiring_soon: boolean
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

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [photoAccess, setPhotoAccess] = useState<PhotoAccess | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [orderInput, setOrderInput] = useState('')
  const [extending, setExtending] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [extendSuccess, setExtendSuccess] = useState('')

  const loadMypage = useCallback(async () => {
    const res = await fetch('/api/mypage')
    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? '정보를 불러오지 못했어요')
      return false
    }
    setEmail(data.email ?? '')
    setPhotoAccess(data.photo_access ?? null)
    setErrorMsg('')
    return true
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.id) {
        router.replace('/login')
        return
      }
      await loadMypage()
      setLoading(false)
    })
  }, [router, loadMypage])

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault()
    setExtendError('')
    setExtendSuccess('')

    if (!orderInput.trim()) {
      setExtendError('주문번호 또는 하이패스를 입력해주세요')
      return
    }

    setExtending(true)

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

      if (!res.ok || !data.success) {
        setExtendError(data.error ?? '인증 실패')
        setExtending(false)
        return
      }

      if (data.already_verified) {
        setExtendError('이미 사용한 주문번호예요. 다른 주문번호를 입력해주세요')
        setExtending(false)
        return
      }

      setExtendSuccess('✅ 인증이 완료됐어요!')
      setOrderInput('')
      await loadMypage()
    } catch {
      setExtendError('요청 중 오류가 발생했어요')
    } finally {
      setExtending(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p className="text-muted">로딩 중...</p>
      </div>
    )
  }

  const totalDays = photoAccess?.photo_access_days_remaining ?? 0
  const status = photoAccess?.status ?? 'none'
  const isExpired = status === 'expired'
  const isExpiringSoon = photoAccess?.expiring_soon ?? false
  const hasAccess = status === 'valid' && totalDays > 0
  const activeVerifications = [
    photoAccess && photoAccess.hipass_days_remaining > 0
      ? {
          label: '하이패스',
          daysRemaining: photoAccess.hipass_days_remaining,
          validityLabel: photoAccess.hipass_validity_label,
        }
      : null,
    photoAccess && photoAccess.purchase_days_remaining > 0
      ? {
          label: '구매 인증',
          daysRemaining: photoAccess.purchase_days_remaining,
          validityLabel: photoAccess.purchase_validity_label,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null)

  return (
    <div className="page-shell">
      <div className="page-container">
        <h1 className="page-title">마이페이지</h1>
        {email && <p className="page-subtitle">{email}</p>}

        {errorMsg && <p className="alert-danger">{errorMsg}</p>}

        <div className="card mb-4 mypage-status-card">
          <h2 className="section-title">사진 열람 만기 현황</h2>

          {status === 'none' ? (
            <div>
              <p className="mypage-dday mypage-dday-muted mb-3 text-center">인증 없음</p>
              <p className="mb-4 text-center text-sm text-muted">인증 기록이 없어요</p>
              <Link href="/#events" className="btn-primary-inline inline-flex no-underline">
                대회 목록에서 인증하기
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <p className="mypage-status-label">사진 열람 가능</p>
              <p className={ddayClass(status, isExpiringSoon)}>
                {formatPhotoAccessDday(totalDays, status)}
              </p>
              <p className="mypage-status-sub">
                {hasAccess ? `사진 열람 가능: ${totalDays}일` : '사진 열람 가능: 0일'}
              </p>

              {activeVerifications.length > 0 ? (
                <div className="mt-4 space-y-2 text-left text-sm text-muted">
                  {activeVerifications.map(item => (
                    <p key={item.label}>
                      {item.label}: {formatPhotoAccessDday(item.daysRemaining, 'valid')}
                      {item.validityLabel && item.validityLabel !== '-'
                        ? ` · ${item.validityLabel}`
                        : ''}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">현재 유효한 인증이 없어요</p>
              )}

              {isExpiringSoon && hasAccess && (
                <div className="alert-warning mt-4 mb-0">⚠️ 곧 만료</div>
              )}

              {isExpired && (
                <div className="alert-danger mt-4 mb-0">
                  ❌ 만료됨. 하이패스 또는 주문번호로 다시 인증해주세요
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card mb-4">
          <h2 className="section-title">인증 연장</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            하이패스 또는 추가 주문번호로 인증하면 만료일이 연장돼요
          </p>

          <form onSubmit={handleExtend}>
            <div className="extend-form-row">
              <div className="flex-1">
                <label htmlFor="extend-order-input" className="label-field">
                  하이패스 / 주문번호
                </label>
                <input
                  id="extend-order-input"
                  type="text"
                  value={orderInput}
                  onChange={e => setOrderInput(e.target.value)}
                  placeholder={NAVER_ORDER_PLACEHOLDER}
                  autoComplete="off"
                  className={`input-field ${extendError ? 'input-field-error' : ''}`}
                />
              </div>
              <button type="submit" disabled={extending} className="btn-primary-inline">
                {extending ? '인증 중...' : '인증 연장하기'}
              </button>
            </div>

            {extendError && <p className="alert-danger mt-3 mb-0">{extendError}</p>}
            {extendSuccess && <p className="alert-success mt-3 mb-0">{extendSuccess}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
