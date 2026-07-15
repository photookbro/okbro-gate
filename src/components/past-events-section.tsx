'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  EVENTS_PAST_SECTION_SUB_MAIN,
  EVENTS_PAST_SECTION_SUB_TAIL,
  formatEventDateDisplay,
  formatPastEventDisplayName,
  GPS_SHOOT_RECORD_DISCLAIMER,
  parseEventsListResponse,
  type EventsListPastEvent,
} from '@/lib/events-list-client'

function PastEventItem({ event }: { event: EventsListPastEvent }) {
  const displayName = formatPastEventDisplayName(event.name, event.has_album)
  const hasLogs = event.gps_logs.length > 0
  const statusIcon = !event.has_album ? '⏳' : hasLogs ? '📸' : '⏳'

  return (
    <li className="event-portrait-item">
      <Link href={`/events/${event.id}`} className="event-portrait-photo-link">
        {!event.has_any_album ? (
          <div className="event-portrait-photo event-portrait-photo-pending">업로드 중입니다</div>
        ) : event.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.photo_url} alt="" className="event-portrait-photo" />
        ) : (
          <div className="event-portrait-photo event-portrait-photo-placeholder" aria-hidden="true">
            📷
          </div>
        )}
        <span className="event-portrait-status-badge" aria-hidden="true">
          {statusIcon}
        </span>
      </Link>

      <Link href={`/events/${event.id}`} className="event-portrait-caption-link mt-3">
        <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
        <span className="events-event-name">{displayName}</span>
      </Link>

      {hasLogs ? (
        <div className="events-past-meta">
          {event.gps_logs.map((record, index) => (
            <p key={`${record.time}-${index}`} className="events-shoot-record">
              <strong>{record.username}</strong>님은 <strong>{record.time}</strong>경에 오켱 카메라
              앞을 지나갔습니다
            </p>
          ))}
          <p className="events-shoot-record-note">{GPS_SHOOT_RECORD_DISCLAIMER}</p>
        </div>
      ) : null}
    </li>
  )
}

export function PastEventsSection() {
  const [past, setPast] = useState<EventsListPastEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    authFetch('/api/events/list')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '목록을 불러오지 못했어요')
          return
        }
        const parsed = parseEventsListResponse(data)
        setPast(parsed.past)
      })
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="events-section landing-events-section">
      <h2 className="events-section-title">🎬 렌즈가 담아온 기록</h2>
      <p className="events-section-sub events-past-section-sub">
        <span>{EVENTS_PAST_SECTION_SUB_MAIN}</span>
        <span className="events-past-section-sub-tail">{EVENTS_PAST_SECTION_SUB_TAIL}</span>
      </p>

      {loading && <p className="text-sm text-muted">로딩 중...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <ul className="event-portrait-grid">
          {past.length === 0 ? (
            <li className="events-empty">오켱 출사 대회가 없어요</li>
          ) : (
            past.map(event => <PastEventItem key={event.id} event={event} />)
          )}
        </ul>
      )}
    </section>
  )
}
