'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GpsTrackingToggle } from '@/components/gps-tracking-toggle'
import {
  EVENTS_PAST_SECTION_SUB_MAIN,
  EVENTS_PAST_SECTION_SUB_TAIL,
  EVENTS_UPCOMING_ON_DETAIL,
  EVENTS_UPCOMING_ON_PROMPT,
  EVENTS_UPCOMING_SECTION_TITLE,
  formatEventDateDisplay,
  GPS_SHOOT_RECORD_DISCLAIMER,
  parseEventsListResponse,
  type EventsListPastEvent,
  type EventsListUpcomingEvent,
} from '@/lib/events-list-client'

function UpcomingEventItem({ event }: { event: EventsListUpcomingEvent }) {
  return (
    <li className="events-list-item">
      <article className="events-card events-card-upcoming">
        <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
        <span className="events-event-name">{event.name}</span>
        {event.show_gps_toggle ? (
          <GpsTrackingToggle eventId={event.id} variant="events-list" />
        ) : null}
      </article>
    </li>
  )
}

function PastEventItem({ event }: { event: EventsListPastEvent }) {
  const record = event.shoot_record
  const hasRecord = record !== null

  return (
    <li className="events-list-item">
      <Link href={`/events/${event.id}`} className="events-card events-card-past">
        <div className="events-past-heading">
          <span className="events-past-icon" aria-hidden="true">
            {hasRecord ? '📸' : '⏳'}
          </span>
          <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
          <span className="events-event-name">{event.name}</span>
        </div>
        {record ? (
          <div className="events-past-meta">
            <p className="events-shoot-record">
              <strong>{record.username}</strong>님은 <strong>{record.time}</strong>경에 오켱 카메라
              앞을 지나갔습니다
            </p>
            <p className="events-shoot-record-note">{GPS_SHOOT_RECORD_DISCLAIMER}</p>
          </div>
        ) : null}
      </Link>
    </li>
  )
}

export default function EventsPage() {
  const [past, setPast] = useState<EventsListPastEvent[]>([])
  const [upcoming, setUpcoming] = useState<EventsListUpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    fetch('/api/events/list')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '목록을 불러오지 못했어요')
          return
        }

        const parsed = parseEventsListResponse(data)
        setPast(parsed.past)
        setUpcoming(parsed.upcoming)
      })
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell">
      <div className="page-container">
        {loading && <p className="text-sm text-muted">로딩 중...</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && (
          <div className="events-page">
            <section className="events-section">
              <h2 className="events-section-title">{EVENTS_UPCOMING_SECTION_TITLE}</h2>
              <p className="events-upcoming-prompt">{EVENTS_UPCOMING_ON_PROMPT}</p>
              <p className="events-upcoming-detail">{EVENTS_UPCOMING_ON_DETAIL}</p>
              <ul className="events-vertical-list">
                {upcoming.length === 0 ? (
                  <li className="events-empty">예정된 대회가 없어요</li>
                ) : (
                  upcoming.map(event => <UpcomingEventItem key={event.id} event={event} />)
                )}
              </ul>
            </section>

            <section className="events-section">
              <h2 className="events-section-title">🎬 오켱 출사 대회</h2>
              <p className="events-section-sub events-past-section-sub">
                <span>{EVENTS_PAST_SECTION_SUB_MAIN}</span>
                <span className="events-past-section-sub-tail">{EVENTS_PAST_SECTION_SUB_TAIL}</span>
              </p>
              <ul className="events-vertical-list">
                {past.length === 0 ? (
                  <li className="events-empty">오켱 출사 대회가 없어요</li>
                ) : (
                  past.map(event => <PastEventItem key={event.id} event={event} />)
                )}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
