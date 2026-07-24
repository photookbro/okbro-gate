'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { GpsTrackingToggle } from '@/components/gps-tracking-toggle'
import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  EVENTS_UPCOMING_ON_DETAIL,
  EVENTS_UPCOMING_ON_PROMPT,
  EVENTS_UPCOMING_SECTION_TITLE,
  formatEventDateDisplay,
  parseEventsListResponse,
  type EventsListUpcomingEvent,
} from '@/lib/events-list-client'

const PlayerLocationPreviewMap = dynamic(
  () => import('@/components/player-location-preview-map').then(mod => mod.PlayerLocationPreviewMap),
  { ssr: false }
)

function UpcomingEventItem({ event }: { event: EventsListUpcomingEvent }) {
  const [trackingEnabled] = useGpsTrackingEnabled(event.id)

  const isMultiMode = event.is_loop_course || event.locations.length > 1
  const hasPassData = isMultiMode ? event.gps_pass_groups.length > 0 : !!event.shoot_record

  return (
    <li className="event-upcoming-item">
      <div className="event-upcoming-row">
        <Link href={`/events/${event.id}`} className="event-upcoming-main-link">
          <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
          <span className="events-event-name-row">
            <span className="events-event-name">{event.name}</span>
            <span className="events-event-detail-hint">상세보기 ›</span>
          </span>
        </Link>
        {event.show_gps_toggle ? (
          <GpsTrackingToggle eventId={event.id} variant="events-list" />
        ) : null}
      </div>

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
        <div className="event-upcoming-map">
          <PlayerLocationPreviewMap locations={event.locations} />
        </div>
      ) : null}
    </li>
  )
}

const UPCOMING_POLL_INTERVAL_MS = 15000

export function UpcomingEventsSection() {
  const [upcoming, setUpcoming] = useState<EventsListUpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    function load(showSpinner: boolean) {
      if (showSpinner) {
        setLoading(true)
        setError('')
      }

      authFetch('/api/events/list')
        .then(async res => {
          const data = await res.json()
          if (cancelled) return
          if (!res.ok) {
            if (showSpinner) {
              setError(typeof data.error === 'string' ? data.error : '목록을 불러오지 못했어요')
            }
            return
          }
          const parsed = parseEventsListResponse(data)
          setUpcoming(parsed.upcoming)
        })
        .catch(() => {
          if (!cancelled && showSpinner) setError('목록을 불러오지 못했어요')
        })
        .finally(() => {
          if (!cancelled && showSpinner) setLoading(false)
        })
    }

    load(true)
    // 통과 시각 텍스트가 새로고침 없이도 반영되도록 주기적으로 조용히 재조회
    const interval = window.setInterval(() => load(false), UPCOMING_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

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
            upcoming.map(event => <UpcomingEventItem key={event.id} event={event} />)
          )}
        </ul>
      )}
    </section>
  )
}
