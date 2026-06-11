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

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '1.25rem',
  marginBottom: '1rem',
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '0.95rem',
  outline: 'none',
  marginBottom: '0.75rem',
}

function formatDDay(daysRemaining: number, status: string): string {
  if (status === 'expired' || daysRemaining < 0) return '만료됨'
  if (daysRemaining === 0) return 'D-Day'
  return `D-${daysRemaining}`
}

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [latest, setLatest] = useState<LatestVerification | null>(null)
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
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: '#6b7280' }}>로딩 중...</p>
      </div>
    )
  }

  const isExpired = latest?.status === 'expired'
  const isExpiringSoon = latest?.expiring_soon
  const hasVerification = !!latest?.expires_at

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>
          마이페이지
        </h1>
        {email && (
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{email}</p>
        )}

        {errorMsg && (
          <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMsg}</p>
        )}

        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 1rem', color: '#111827' }}>
            사진 열람 만기 현황
          </h2>

          {!hasVerification ? (
            <div>
              <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                인증 기록이 없어요
              </p>
              <Link
                href="/events"
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                대회 목록에서 인증하기
              </Link>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: '#6b7280' }}>만료일</span>
                  <br />
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {formatVerificationDate(latest?.expires_at)}
                  </span>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <span style={{ color: '#6b7280' }}>남은 기간</span>
                  <br />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      color: isExpired ? '#9ca3af' : isExpiringSoon ? '#d97706' : '#2563eb',
                    }}
                  >
                    {formatDDay(latest?.days_remaining ?? 0, latest?.status ?? 'expired')}
                  </span>
                </div>
              </div>

              {isExpiringSoon && !isExpired && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚠️ 곧 만료돼요!
                </div>
              )}

              {isExpired && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                  }}
                >
                  ❌ 만료됨. 새 주문번호로 인증해주세요
                </div>
              )}
            </>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#111827' }}>
            인증 연장
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
            추가 주문번호로 인증하면 만료일이 연장돼요
          </p>

          <form onSubmit={handleExtend}>
            <label
              htmlFor="extend-order-input"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              추가 주문번호
            </label>
            <input
              id="extend-order-input"
              type="text"
              value={orderInput}
              onChange={e => setOrderInput(e.target.value)}
              placeholder="2024-XXXXXXXX-XXXXXXXX"
              autoComplete="off"
              style={{
                ...inputStyle,
                borderColor: extendError ? '#ef4444' : '#d1d5db',
              }}
            />

            {extendError && (
              <p
                style={{
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  margin: '0 0 0.75rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                }}
              >
                {extendError}
              </p>
            )}

            {extendSuccess && (
              <p
                style={{
                  color: '#166534',
                  fontSize: '0.85rem',
                  margin: '0 0 0.75rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                }}
              >
                {extendSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={extending}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: extending ? '#9ca3af' : '#2563eb',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: extending ? 'not-allowed' : 'pointer',
              }}
            >
              {extending ? '인증 중...' : '인증하고 연장하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
