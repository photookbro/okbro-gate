'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VerificationInfo } from '@/lib/order-verification'
import { AlbumAccessModal } from '@/components/album-access-modal'

type Event = {
  id: string
  name: string
  date: string
  album_a_url: string | null
  album_b_url: string | null
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [event, setEvent] = useState<Event | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [verification, setVerification] = useState<VerificationInfo>({ status: 'none' })
  const [verificationChecked, setVerificationChecked] = useState(false)
  const [showAlbumModal, setShowAlbumModal] = useState(false)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, date, album_a_url, album_b_url')
      .eq('id', id)
      .single()
      .then(({ data }) => setEvent(data))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [id])

  useEffect(() => {
    if (!userId) {
      setVerification({ status: 'none' })
      setVerificationChecked(true)
      return
    }

    setVerificationChecked(false)
    fetch('/api/verify-order/status')
      .then(async res => {
        const data = await res.json()
        if (!res.ok || !data?.status) {
          setVerification({ status: 'none' })
          return
        }
        setVerification(data as VerificationInfo)
      })
      .catch(() => {
        setVerification({ status: 'none' })
      })
      .finally(() => {
        setVerificationChecked(true)
      })
  }, [userId])

  function handleAlbumA() {
    if (!event?.album_a_url) return
    window.open(event.album_a_url, '_blank', 'noopener,noreferrer')
  }

  function handleAlbumB() {
    if (!event?.album_b_url || !verificationChecked) return

    if (!userId || verification.status !== 'valid') {
      if (id) {
        router.push(`/verify-order?eventId=${id}`)
      }
      return
    }

    setShowAlbumModal(true)
  }

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
      </div>
    )
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/events" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← 대회 목록
        </Link>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '1rem 0 0.25rem' }}>
          {event.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          📅 {event.date}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleAlbumA}
            disabled={!event.album_a_url}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              cursor: event.album_a_url ? 'pointer' : 'not-allowed',
              opacity: event.album_a_url ? 1 : 0.5,
            }}
          >
            📸 사진 보기 (무료)
          </button>

          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAlbumB}
              disabled={!event.album_b_url || (!!userId && !verificationChecked)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                cursor: event.album_b_url ? 'pointer' : 'not-allowed',
                opacity: event.album_b_url ? 1 : 0.5,
              }}
            >
              ⭐ 고화질 다운로드
            </button>

            {event.album_b_url && verificationChecked && !isValid && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
                {isExpired
                  ? '⚠️ 인증이 만료됐어요. 새 주문번호로 다시 인증해주세요.'
                  : '⭐ 고화질은 과일 구매 인증 후 이용 가능해요'}
              </p>
            )}
          </div>
        </div>
      </div>

      {event.album_b_url && (
        <AlbumAccessModal
          visible={showAlbumModal}
          onClose={() => setShowAlbumModal(false)}
          verification={verification}
          albumBUrl={event.album_b_url}
        />
      )}
    </div>
  )
}
