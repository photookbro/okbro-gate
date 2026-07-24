'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import { NAVER_ORDER_PLACEHOLDER } from '@/lib/naver-order-number'
import { AlbumAccessModal } from '@/components/album-access-modal'
import { OrderNumberGuide } from '@/components/order-number-guide'

function VerifyOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const supabase = createClient()

  const [orderInput, setOrderInput] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [verification, setVerification] = useState<VerificationInfo>({ status: 'none' })
  const [statusLoading, setStatusLoading] = useState(true)
  const [albumBUrl, setAlbumBUrl] = useState<string | null>(null)
  const [albumAUrl, setAlbumAUrl] = useState<string | null>(null)
  const [showAlbumModal, setShowAlbumModal] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        const next = eventId
          ? `/verify-order?eventId=${encodeURIComponent(eventId)}`
          : '/verify-order'
        router.replace(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      setAuthChecked(true)
    })
  }, [router, eventId, supabase.auth])

  useEffect(() => {
    if (!authChecked) return

    let cancelled = false
    setStatusLoading(true)

    async function load() {
      try {
        const statusUrl = eventId
          ? `/api/verify-order/status?event_id=${encodeURIComponent(eventId)}`
          : '/api/verify-order/status'

        const statusRes = await fetch(statusUrl)
        const statusData = await statusRes.json()
        if (cancelled) return

        if (statusRes.ok && statusData?.status) {
          setVerification(statusData as VerificationInfo)
        } else {
          setVerification({ status: 'none' })
        }

        if (eventId) {
          const { data: event } = await supabase
            .from('events')
            .select('album_a_url, album_b_url')
            .eq('id', eventId)
            .single()
          if (cancelled) return
          setAlbumBUrl(event?.album_b_url ?? null)
          setAlbumAUrl(event?.album_a_url ?? null)
        } else {
          setAlbumBUrl(null)
          setAlbumAUrl(null)
        }
      } catch {
        if (!cancelled) {
          setVerification({ status: 'none' })
          setAlbumBUrl(null)
          setAlbumAUrl(null)
        }
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authChecked, eventId, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!orderInput.trim()) {
      setErrorMsg('주문번호를 입력해주세요')
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
          ...(eventId ? { event_id: eventId } : {}),
        }),
      })

      const data = await res.json()

      if (data.success) {
        const statusRes = await fetch(
          eventId
            ? `/api/verify-order/status?event_id=${encodeURIComponent(eventId)}`
            : '/api/verify-order/status'
        )
        const statusData = await statusRes.json()
        if (statusRes.ok && statusData?.status) {
          setVerification(statusData as VerificationInfo)
        }
        setOrderInput('')
        setLoading(false)

        if (albumBUrl) {
          setShowAlbumModal(true)
        } else if (eventId) {
          router.push(`/events/${eventId}`)
        }
      } else {
        setErrorMsg(data.error ?? '인증 실패')
        setLoading(false)
      }
    } catch {
      setErrorMsg('요청 중 오류가 발생했어요')
      setLoading(false)
    }
  }

  function handleOpenAlbumB() {
    if (!albumBUrl) return
    setShowAlbumModal(true)
  }

  if (!authChecked || statusLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
      </div>
    )
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'
  const isExtendFlow = verification.status !== 'none'
  const pageTitle = isExtendFlow ? '인증 연장' : '주문 인증'
  const submitLabel = isExtendFlow ? '인증 연장하기' : '인증하기'

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        padding: '2rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <Link
          href={eventId ? `/events/${eventId}` : '/events'}
          style={{
            display: 'inline-block',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-caption-size)',
            textDecoration: 'none',
            marginBottom: '1rem',
          }}
        >
          {eventId ? '← 대회로 돌아가기' : '← 대회 목록으로'}
        </Link>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: '1.75rem',
          }}
        >
          {isValid && verification?.verified_at && verification?.expires_at && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--color-success-bg)',
                border: '1px solid var(--color-success-border)',
                color: '#66bb6a',
                fontSize: 'var(--font-body-size)',
                lineHeight: 'var(--font-body-line-height)',
              }}
            >
              ✅ 인증 완료 - {verification?.order_number ?? '-'} /{' '}
              {formatVerificationDate(verification?.verified_at)} ~{' '}
              {formatVerificationDate(verification?.expires_at)}
            </div>
          )}

          {isExpired && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-border)',
                color: '#e0b94d',
                fontSize: 'var(--font-body-size)',
                lineHeight: 'var(--font-body-line-height)',
              }}
            >
              ⚠️ 인증이 만료됐어요. 새 주문번호로 다시 인증해주세요.
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
            <h1
              style={{
                fontSize: 'var(--font-h2-size)',
                fontWeight: 700,
                lineHeight: 'var(--font-h2-line-height)',
                color: 'var(--text)',
                margin: '0 0 0.5rem',
              }}
            >
              {pageTitle}
            </h1>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-body-size)',
                margin: 0,
                lineHeight: 'var(--font-body-line-height)',
              }}
            >
              {isExtendFlow
                ? '추가 주문번호로 인증하면 만료일이 연장돼요'
                : '네이버 주문번호를 입력해주세요'}
            </p>
          </div>

          {isValid && albumBUrl ? (
            <button
              type="button"
              onClick={handleOpenAlbumB}
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '1.25rem',
              }}
            >
              ⭐ 고화질 앨범 열기
            </button>
          ) : null}

          <form onSubmit={e => void handleSubmit(e)}>
            <label
              htmlFor="order-input"
              style={{
                display: 'block',
                fontSize: 'var(--font-body-size)',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '0.5rem',
              }}
            >
              네이버 주문번호
            </label>
            <OrderNumberGuide />
            <input
              id="order-input"
              type="text"
              value={orderInput}
              onChange={e => setOrderInput(e.target.value)}
              placeholder={NAVER_ORDER_PLACEHOLDER}
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '8px',
                border: `1px solid ${errorMsg ? 'var(--danger)' : 'var(--border)'}`,
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 'var(--font-body-size)',
                lineHeight: 'var(--font-body-line-height)',
                outline: 'none',
                marginBottom: '0.5rem',
                marginTop: '0.5rem',
              }}
            />

            {errorMsg ? (
              <p
                style={{
                  color: '#ff6b52',
                  fontSize: 'var(--font-body-size)',
                  margin: '0 0 1rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--color-danger-bg)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-danger-border)',
                }}
              >
                {errorMsg}
              </p>
            ) : null}

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
                backgroundColor: loading ? 'var(--disabled)' : 'var(--primary)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '인증 중...' : submitLabel}
            </button>
          </form>
        </div>
      </div>

      {albumBUrl ? (
        <AlbumAccessModal
          visible={showAlbumModal}
          onClose={() => setShowAlbumModal(false)}
          verification={verification}
          albumBUrl={albumBUrl}
          albumAUrl={albumAUrl}
        />
      ) : null}
    </div>
  )
}

export default function VerifyOrderPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
        </div>
      }
    >
      <VerifyOrderContent />
    </Suspense>
  )
}
