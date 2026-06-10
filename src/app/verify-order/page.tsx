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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link
          href={`/events/${eventId}`}
          style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}
        >
          ← 대회로 돌아가기
        </Link>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
          주문 인증
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          네이버 주문번호 또는 공동 인증번호를 입력해주세요
        </p>

        <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem' }}>
          <label
            htmlFor="order-input"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}
          >
            네이버 주문번호 / 공동 인증번호
          </label>
          <input
            id="order-input"
            value={orderInput}
            onChange={e => setOrderInput(e.target.value)}
            placeholder="2024-XXXXXXXX-XXXXXXXX"
            autoComplete="off"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${errorMsg ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '0.95rem',
              outline: 'none',
              marginBottom: '0.75rem',
            }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
            네이버 주문번호 형식: 2024-XXXXXXXX-XXXXXXXX
          </p>

          {errorMsg && (
            <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '인증 중...' : '인증하기'}
          </button>
        </form>
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
