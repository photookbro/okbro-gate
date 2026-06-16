'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VerificationInfo } from '@/lib/order-verification'
import { AlbumAccessModal } from '@/components/album-access-modal'
import { BAlbumView } from '@/components/b-album-view'
import { AAlbumView } from '@/components/a-album-view'
import { TermsAgreement } from '@/components/terms-agreement'
import { hasTermsAgreed } from '@/lib/terms-agreement'
import { resolveEventAlbumBranch } from '@/lib/event-album-branch'

function formatEventDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

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
  const [termsReady, setTermsReady] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)

  useEffect(() => {
    setTermsAgreed(hasTermsAgreed())
    setTermsReady(true)
  }, [])

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
      setVerification({ status: 'none', purchase_verified: false })
      setVerificationChecked(true)
      return
    }

    setVerificationChecked(false)
    fetch(`/api/verify-order/status?event_id=${encodeURIComponent(id)}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok || !data?.status) {
          setVerification({ status: 'none', purchase_verified: false })
          return
        }
        setVerification(data as VerificationInfo)
      })
      .catch(() => {
        setVerification({ status: 'none', purchase_verified: false })
      })
      .finally(() => {
        setVerificationChecked(true)
      })
  }, [userId, id])

  const albumBranch = verificationChecked ? resolveEventAlbumBranch(verification) : null

  useEffect(() => {
    if (albumBranch === 'purchase-modal') {
      setShowAlbumModal(true)
    }
  }, [albumBranch])

  if (!termsReady || !event) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>로딩 중...</p>
      </div>
    )
  }

  const eventData = event

  if (!termsAgreed) {
    return (
      <TermsAgreement
        visible
        mode="page"
        onComplete={() => setTermsAgreed(true)}
        onClose={() => router.push('/events')}
      />
    )
  }

  function renderAlbumSection() {
    if (!verificationChecked) {
      return <p className="text-sm text-muted">인증 정보 확인 중...</p>
    }

    if (albumBranch === 'b-album' && eventData.album_b_url) {
      return <BAlbumView albumBUrl={eventData.album_b_url} gpsTime={verification.gps_passed_at!} />
    }

    if (albumBranch === 'purchase-modal' && eventData.album_b_url) {
      return (
        <>
          {!showAlbumModal && (
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setShowAlbumModal(true)}
            >
              ⬇️ 고화질 다운로드
            </button>
          )}
          <AlbumAccessModal
            visible={showAlbumModal}
            onClose={() => setShowAlbumModal(false)}
            verification={verification}
            albumBUrl={eventData.album_b_url}
            albumAUrl={eventData.album_a_url}
          />
        </>
      )
    }

    return (
      <AAlbumView
        albumAUrl={eventData.album_a_url}
        incentive="고화질을 보려면 과일 구매!"
        eventId={eventData.id}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/events" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← 대회 목록
        </Link>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '1rem 0 0.25rem' }}>
          {event.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          📅 {formatEventDate(event.date)}
        </p>

        {renderAlbumSection()}
      </div>
    </div>
  )
}
