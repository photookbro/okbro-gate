'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GpsTrackingToggle } from '@/components/gps-tracking-toggle'
import { useEventsList } from '@/components/events-list-provider'
import { LazyPlayerLocationPreviewMap } from '@/components/lazy-player-location-preview-map'
import {
  hasAnyGpsTrackingEnabled,
  subscribeGpsTrackingChange,
  useGpsTrackingEnabled,
} from '@/lib/gps-tracking-storage'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  EVENTS_UPCOMING_ON_DETAIL,
  EVENTS_UPCOMING_ON_PROMPT,
  EVENTS_UPCOMING_SECTION_TITLE,
  formatEventDateDisplay,
  type EventsListUpcomingEvent,
} from '@/lib/events-list-client'

/** GPS ON인 대회가 있을 때만 통과 시각 갱신 — 60초 간격 */
const UPCOMING_POLL_INTERVAL_MS = 60_000

function UpcomingEventItem({
  event,
  globalGpsTrackingEligible,
}: {
  event: EventsListUpcomingEvent
  /** null = 자격 조회 중 — 미인증 문구를 그리지 않음 */
  globalGpsTrackingEligible: boolean | null
}) {
  const [trackingEnabled] = useGpsTrackingEnabled(event.id)
  const eligibilityReady = globalGpsTrackingEligible !== null
  const canToggleGps =
    event.is_pay_event || globalGpsTrackingEligible === true

  const isMultiMode = event.locations.length > 1
  const hasPassData = isMultiMode ? event.gps_pass_groups.length > 0 : !!event.shoot_record
  // 앨범이 올라온 당일(예정 섹션)은 GPS OFF여도 상세/앨범 진입 가능해야 함
  const canOpenDetail = !event.show_gps_toggle || trackingEnabled || event.has_album
  const albumHint = event.has_album ? '앨범보기 ›' : canOpenDetail ? '상세보기 ›' : null

  const mainContent = (
    <>
      <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
      <span className="events-event-name-row">
        <span className="events-event-name">{event.name}</span>
        {albumHint ? <span className="events-event-detail-hint">{albumHint}</span> : null}
      </span>
    </>
  )

  return (
    <li className="event-upcoming-item">
      <div className="event-upcoming-row">
        {canOpenDetail ? (
          <Link href={`/events/${event.id}`} className="event-upcoming-main-link">
            {mainContent}
          </Link>
        ) : (
          <div className="event-upcoming-main-link" aria-disabled="true">
            {mainContent}
          </div>
        )}
        {event.show_gps_toggle ? (
          <div className="events-gps-switch-col">
            <GpsTrackingToggle
              eventId={event.id}
              variant="events-list"
              disabled={!canToggleGps}
            />
            {event.is_pay_event ? (
              <span className="events-gps-purchase-hint">대회 서비스 일부로 제공</span>
            ) : eligibilityReady && !canToggleGps ? (
              <Link
                href="/verify-order"
                className="events-gps-purchase-hint"
                onClick={e => e.stopPropagation()}
              >
                구매 인증 후 이용 가능해요
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {event.has_album ? (
        <div className="events-upcoming-album-actions">
          <Link href={`/events/${event.id}`} className="btn-primary-inline no-underline">
            앨범보기
          </Link>
        </div>
      ) : null}

      {trackingEnabled && hasPassData && (
        <div className="events-past-meta">
          {isMultiMode
            ? event.gps_pass_groups.map(group => (
                <p key={group.location_number} className="events-shoot-record">
                  {event.gps_pass_groups.length > 1 && (
                    <strong>{group.location_number}차 위치 </strong>
                  )}
                  {group.passes
                    .map(pass => `${pass.pass_count}차 통과: ${pass.display_time}`)
                    .join(' · ')}
                </p>
              ))
            : event.shoot_record && (
                <p className="events-shoot-record">
                  <strong>{event.shoot_record.username}</strong>님은{' '}
                  <strong>{event.shoot_record.time}</strong>경에 오켱 카메라 앞을 지나갔습니다
                </p>
              )}
        </div>
      )}

      {event.locations.length > 0 ? (
        <LazyPlayerLocationPreviewMap locations={event.locations} />
      ) : null}
    </li>
  )
}

export function UpcomingEventsSection() {
  const { upcoming, loading, error, quietReload } = useEventsList()
  /** null = /api/verify-order/status 응답 전 — 미인증 문구/토글 활성 판단 보류 */
  const [globalGpsTrackingEligible, setGlobalGpsTrackingEligible] = useState<boolean | null>(
    null
  )
  const [anyGpsTrackingOn, setAnyGpsTrackingOn] = useState(false)

  useEffect(() => {
    let cancelled = false

    authFetch('/api/verify-order/status')
      .then(async res => {
        const data = await res.json()
        if (cancelled) return
        setGlobalGpsTrackingEligible(res.ok && data?.gps_tracking_eligible === true)
      })
      .catch(() => {
        if (!cancelled) setGlobalGpsTrackingEligible(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function syncGpsGate() {
      const ids = upcoming.filter(e => e.show_gps_toggle).map(e => e.id)
      setAnyGpsTrackingOn(hasAnyGpsTrackingEnabled(ids))
    }

    syncGpsGate()
    return subscribeGpsTrackingChange(syncGpsGate)
  }, [upcoming])

  useEffect(() => {
    if (!anyGpsTrackingOn) return

    const interval = window.setInterval(() => {
      quietReload()
    }, UPCOMING_POLL_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
    }
  }, [anyGpsTrackingOn, quietReload])

  return (
    <section className="events-section landing-events-section">
      <h2 className="events-section-title">{EVENTS_UPCOMING_SECTION_TITLE}</h2>
      <p className="events-upcoming-prompt">{EVENTS_UPCOMING_ON_PROMPT}</p>
      <p className="events-upcoming-detail">{EVENTS_UPCOMING_ON_DETAIL}</p>

      {loading && <p className="text-sm text-muted">로딩 중...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <ul className="event-upcoming-list">
          {upcoming.length === 0 ? (
            <li className="events-empty">예정된 대회가 없어요</li>
          ) : (
            upcoming.map(event => (
              <UpcomingEventItem
                key={event.id}
                event={event}
                globalGpsTrackingEligible={globalGpsTrackingEligible}
              />
            ))
          )}
        </ul>
      )}
    </section>
  )
}
