'use client'

import { useEffect, useState } from 'react'
import { GpsTrackingToggle } from '@/components/gps-tracking-toggle'
import {
  EVENTS_UPCOMING_ON_DETAIL,
  EVENTS_UPCOMING_ON_PROMPT,
  EVENTS_UPCOMING_SECTION_TITLE,
  formatEventDateDisplay,
  parseEventsListResponse,
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

export function UpcomingEventsSection() {
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
        setUpcoming(parsed.upcoming)
      })
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="events-section landing-events-section">
      <h2 className="events-section-title">{EVENTS_UPCOMING_SECTION_TITLE}</h2>
      <p className="events-upcoming-prompt">{EVENTS_UPCOMING_ON_PROMPT}</p>
      <p className="events-upcoming-detail">{EVENTS_UPCOMING_ON_DETAIL}</p>

      {loading && <p className="text-sm text-muted">로딩 중...</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!loading && !error && (
        <ul className="events-vertical-list">
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
