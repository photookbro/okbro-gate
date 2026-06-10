'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function VerifyOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const supabase = createClient()

  const [orderInput, setOrderInput] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        router.replace('/login')
        return
      }
      setAuthChecked(true)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!orderInput.trim()) {
      setErrorMsg('주문번호 또는 공동 인증번호를 입력해주세요')
      return
    }
    if (!eventId) {
      setErrorMsg('대회 정보를 찾을 수 없어요')
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

      if (data.success) {
        router.push(`/events/${eventId}`)
      } else {
        setErrorMsg(data.error ?? '인증 실패')
        setLoading(false)
      }
    } catch {
      setErrorMsg('요청 중 오류가 발생했어요')
      setLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
      </div>
    )
  }

  if (!eventId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>대회 정보가 없어요</p>
          <Link href="/events" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
            대회 목록으로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '2rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <Link
          href={`/events/${eventId}`}
          style={{
            display: 'inline-block',
            color: '#6b7280',
            fontSize: '0.85rem',
            textDecoration: 'none',
            marginBottom: '1rem',
          }}
        >
          ← 대회로 돌아가기
        </Link>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
            padding: '1.75rem',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem' }}>
              주문 인증
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
              네이버 주문번호 또는 공동 인증번호를 입력해주세요
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="order-input"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem',
              }}
            >
              네이버 주문번호 / 공동 인증번호
            </label>
            <input
              id="order-input"
              type="text"
              value={orderInput}
              onChange={e => setOrderInput(e.target.value)}
              placeholder="2024-XXXXXXXX-XXXXXXXX"
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '8px',
                border: `1px solid ${errorMsg ? '#ef4444' : '#d1d5db'}`,
                backgroundColor: '#ffffff',
                color: '#111827',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                outline: 'none',
                marginBottom: '0.5rem',
              }}
            />
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0 0 1rem', lineHeight: 1.4 }}>
              네이버 주문번호 형식: 2024-XXXXXXXX-XXXXXXXX
            </p>

            {errorMsg && (
              <p
                style={{
                  color: '#ef4444',
                  fontSize: '0.8rem',
                  margin: '0 0 1rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                }}
              >
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: loading ? '#9ca3af' : '#2563eb',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '인증 중...' : '인증하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function VerifyOrderPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
        </div>
      }
    >
      <VerifyOrderContent />
    </Suspense>
  )
}
