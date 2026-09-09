'use client'

import Link from 'next/link'
import {
  EVENTS_PAST_SECTION_SUB_MAIN,
  EVENTS_PAST_SECTION_SUB_TAIL,
  formatEventDateDisplay,
  type EventsListPastEvent,
} from '@/lib/events-list-client'
import { useEventsList } from '@/components/events-list-provider'

function PastEventItem({ event }: { event: EventsListPastEvent }) {
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
      </Link>

      <Link href={`/events/${event.id}`} className="event-portrait-caption-link mt-3">
        <span className="events-event-date">{formatEventDateDisplay(event.date)}</span>
        <span className="events-event-name">{event.name}</span>
      </Link>
    </li>
  )
}

export function PastEventsSection() {
  const { past, loading, error } = useEventsList()

  return (
    <section className="events-section landing-events-section">
      <h2 className="events-section-title">🎬 사진 찾아가세요!</h2>
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
