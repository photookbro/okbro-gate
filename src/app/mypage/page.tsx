'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatVerificationDate } from '@/lib/order-verification'

type LatestVerification = {
  expires_at: string | null
  days_remaining: number
  status: string
  expiring_soon: boolean
}

type ShootRecord = {
  type: 'gps' | 'purchase'
  event_id: string | null
  event_name: string
  passed_at: string
  display_time: string
  description: string
}

function formatDDay(daysRemaining: number, status: string): string {
  if (status === 'expired' || daysRemaining < 0) return '만료됨'
  if (daysRemaining === 0) return 'D-Day'
  return `D-${daysRemaining}`
}

function ddayClass(status: string, expiringSoon: boolean): string {
  if (status === 'expired') return 'mypage-dday mypage-dday-muted'
  if (expiringSoon) return 'mypage-dday mypage-dday-danger'
  return 'mypage-dday mypage-dday-success'
}

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [latest, setLatest] = useState<LatestVerification | null>(null)
  const [shootRecords, setShootRecords] = useState<ShootRecord[]>([])
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
    setLatest(data.latest_verification ?? null)
    setShootRecords(data.shoot_records ?? [])
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
      setExtendError('주문번호 또는 공동 인증번호를 입력해주세요')
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

      const newExpiresAt = data.expires_at as string | undefined
      if (newExpiresAt) {
        setExtendSuccess(`✅ ${formatVerificationDate(newExpiresAt)}까지 연장됐어요!`)
      } else {
        setExtendSuccess('✅ 인증이 완료됐어요!')
      }

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

  const isExpired = latest?.status === 'expired'
  const isExpiringSoon = latest?.expiring_soon
  const hasVerification = !!latest?.expires_at

  return (
    <div className="page-shell">
      <div className="page-container">
        <h1 className="page-title">마이페이지</h1>
        {email && <p className="page-subtitle">{email}</p>}

        {errorMsg && <p className="alert-danger">{errorMsg}</p>}

        <div className="card mb-4">
          <h2 className="section-title">사진 열람 만기 현황</h2>

          {!hasVerification ? (
            <div>
              <p className="mb-4 text-sm text-muted">인증 기록이 없어요</p>
              <Link href="/events" className="btn-primary-inline inline-flex no-underline">
                대회 목록에서 인증하기
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-4 text-center">
                <p className="mb-2 text-sm text-muted">남은 기간</p>
                <p className={ddayClass(latest?.status ?? 'expired', !!isExpiringSoon)}>
                  {formatDDay(latest?.days_remaining ?? 0, latest?.status ?? 'expired')}
                </p>
                {!isExpired && (
                  <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
                    {latest?.days_remaining ?? 0}일 남음
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-center">
                <p className="mb-1 text-xs text-muted">만료일</p>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {formatVerificationDate(latest?.expires_at)}
                </p>
              </div>

              {isExpiringSoon && !isExpired && (
                <div className="alert-warning mt-4 mb-0">⚠️ 곧 만료돼요!</div>
              )}

              {isExpired && (
                <div className="alert-danger mt-4 mb-0">❌ 만료됨. 새 주문번호로 인증해주세요</div>
              )}
            </>
          )}
        </div>

        <div className="card mb-4">
          <h2 className="section-title">🎬 내 촬영 시각 기록</h2>
          {shootRecords.length === 0 ? (
            <p className="text-sm text-muted">아직 기록된 촬영 시각이 없어요</p>
          ) : (
            <ul className="space-y-3">
              {shootRecords.map(record => (
                <li
                  key={`${record.type}-${record.event_id ?? 'none'}-${record.passed_at}`}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">{record.event_name}</p>
                  <p className="mt-1 text-sm text-[var(--text)]">
                    {record.type === 'gps' ? 'GPS 통과' : '구매 인증'}: {record.display_time}{' '}
                    <span className="text-muted">({record.description})</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">인증 연장</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            추가 주문번호로 인증하면 만료일이 연장돼요
          </p>

          <form onSubmit={handleExtend}>
            <div className="extend-form-row">
              <div className="flex-1">
                <label htmlFor="extend-order-input" className="label-field">
                  추가 주문번호
                </label>
                <input
                  id="extend-order-input"
                  type="text"
                  value={orderInput}
                  onChange={e => setOrderInput(e.target.value)}
                  placeholder="2024-XXXXXXXX-XXXXXXXX"
                  autoComplete="off"
                  className={`input-field ${extendError ? 'input-field-error' : ''}`}
                />
              </div>
              <button type="submit" disabled={extending} className="btn-primary-inline">
                {extending ? '인증 중...' : '인증하고 연장하기'}
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
