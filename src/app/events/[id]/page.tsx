'use client'

import { useState, useEffect, use, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { VerificationInfo } from '@/lib/order-verification'
import { AlbumAccessSection } from '@/components/album-access-section'
import { BAlbumView } from '@/components/b-album-view'
import { AAlbumView } from '@/components/a-album-view'
import { TermsAgreement } from '@/components/terms-agreement'
import { GpsDetector } from '@/components/gps-detector'
import { GpsTrackingBanner } from '@/components/gps-tracking-banner'
import { EventPermissionGate } from '@/components/missing-permissions-modal'
import { hasTermsAgreed } from '@/lib/terms-agreement'
import { resolveEventAlbumBranch } from '@/lib/event-album-branch'
import { getEventGpsLocations, type EventGpsFields } from '@/lib/gps-locations'

function formatEventDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

type Event = EventGpsFields & {
  id: string
  name: string
  date: string
  album_a_url: string | null
  album_b_url: string | null
  gps_enabled: boolean | null
  is_loop_course: boolean | null
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [event, setEvent] = useState<Event | null>(null)
  const [eventLoading, setEventLoading] = useState(true)
  const [eventError, setEventError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [verification, setVerification] = useState<VerificationInfo>({ status: 'none' })
  const [verificationChecked, setVerificationChecked] = useState(false)
  const [termsReady, setTermsReady] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)

  const locations = useMemo(
    () => (event ? getEventGpsLocations(event) : []),
    [event]
  )

  useEffect(() => {
    setTermsAgreed(hasTermsAgreed())
    setTermsReady(true)
  }, [])

  useEffect(() => {
    setEventLoading(true)
    setEventError('')
    setEvent(null)

    fetch(`/api/events/${encodeURIComponent(id)}`)
      .then(async res => {
        const data = await res.json()
        if (res.ok && data?.event) {
          setEvent(data.event as Event)
          return
        }
        setEventError(
          typeof data?.error === 'string' ? data.error : '대회 정보를 불러오지 못했어요.'
        )
      })
      .catch(() => {
        setEventError('대회 정보를 불러오지 못했어요.')
      })
      .finally(() => {
        setEventLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [id, supabase.auth])

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
  const purchaseVerified = verification.status === 'valid'

  if (!termsReady || eventLoading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p className="text-muted">잠시만 기다리세요. 대회 정보를 불러오고 있습니다.</p>
      </div>
    )
  }

  if (eventError || !event) {
    return (
      <div className="page-shell flex items-center justify-center">
        <p className="text-muted">{eventError || '대회 정보를 불러오지 못했어요.'}</p>
      </div>
    )
  }

  if (!termsAgreed) {
    return (
      <TermsAgreement
        visible
        mode="page"
        onComplete={() => setTermsAgreed(true)}
        onClose={() => router.push('/#events')}
      />
    )
  }

  function renderAlbumSection() {
    if (!verificationChecked) {
      return <p className="text-sm text-muted">인증 정보 확인 중...</p>
    }

    if (albumBranch === 'b-album' && event!.album_b_url) {
      return <BAlbumView albumBUrl={event!.album_b_url} gpsTime={verification.gps_passed_at!} />
    }

    if (albumBranch === 'purchase-modal' && event!.album_b_url) {
      return (
        <AlbumAccessSection
          verification={verification}
          albumBUrl={event!.album_b_url}
          albumAUrl={event!.album_a_url}
        />
      )
    }

    return (
      <AAlbumView
        albumAUrl={event!.album_a_url}
        incentive="이 장면을 고화질로 만나보세요"
        eventId={event!.id}
      />
    )
  }

  return (
    <>
      <GpsTrackingBanner eventId={id} />
      <div className="page-shell event-detail-page">
        <div className="page-container-wide">
          <Link href="/#events" className="text-sm text-muted no-underline">
            ← 대회 목록
          </Link>

          <h1 className="page-title mt-3">{event.name}</h1>
          <p className="page-subtitle mb-6">📅 {formatEventDate(event.date)}</p>

          {event.gps_enabled === true && locations.length > 0 ? (
            <div className="mb-6">
              <EventPermissionGate enabled={termsAgreed && !!userId}>
                <GpsDetector
                  eventId={event.id}
                  eventName={event.name}
                  locations={locations}
                  isLoopCourse={event.is_loop_course === true}
                  userId={userId}
                  purchaseVerified={purchaseVerified}
                  verificationChecked={verificationChecked}
                />
              </EventPermissionGate>
            </div>
          ) : null}

          <h2 className="section-title">B급 순간들, 오켱이 담은 나</h2>
          {renderAlbumSection()}
        </div>
      </div>
    </>
  )
}
