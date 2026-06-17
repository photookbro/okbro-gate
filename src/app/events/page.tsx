'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GpsTrackingToggle } from '@/components/gps-tracking-toggle'

type PastEvent = {
  id: string
  name: string
  date: string
  shoot_record: { username: string; time: string } | null
}

type UpcomingEvent = {
  id: string
  name: string
  date: string
  gps_enabled: boolean | null
}

function formatEventDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function EventsPage() {
  const [past, setPast] = useState<PastEvent[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch('/api/events/list')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? '목록을 불러오지 못했어요')
          return
        }
        setPast(data.past ?? [])
        setUpcoming(data.upcoming ?? [])
      })
      .catch(() => setError('목록을 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell">
      <div className="page-container-wide">
        <h1 className="mb-6 text-xl font-bold">📋 대회 목록</h1>

        {loading && <p className="text-sm text-muted">로딩 중...</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        {!loading && !error && (
          <div className="events-split">
            <section className="events-column">
              <h2 className="events-column-title">과거 대회</h2>
              <p className="events-column-sub">고화소 앨범 업로드 완료 · 최근 12개월</p>
              <ul className="events-list">
                {past.length === 0 && (
                  <li className="events-empty">과거 대회가 없어요</li>
                )}
                {past.map(event => (
                  <li key={event.id}>
                    <Link href={`/events/${event.id}`} className="events-row">
                      <div className="events-row-main">
                        <span className="events-row-name">{event.name}</span>
                        <span className="events-row-date">({formatEventDate(event.date)})</span>
                      </div>
                      <div className="events-row-meta">
                        {event.shoot_record ? (
                          <span className="events-shoot-record">
                            <strong>{event.shoot_record.username}</strong>님은{' '}
                            <strong>{event.shoot_record.time}</strong>에 오켱 카메라 앞을
                            지나갔습니다.
                          </span>
                        ) : (
                          <span className="events-shoot-record events-shoot-record-empty">&nbsp;</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="events-column">
              <h2 className="events-column-title">예정 대회</h2>
              <p className="events-column-sub">앨범 준비 중</p>
              <ul className="events-list">
                {upcoming.length === 0 && (
                  <li className="events-empty">예정된 대회가 없어요</li>
                )}
                {upcoming.map(event => (
                  <li key={event.id}>
                    <div className="events-row events-row-disabled" aria-disabled="true">
                      <div className="events-row-main events-row-main-inline">
                        <div>
                          <span className="events-row-name">{event.name}</span>
                          <span className="events-row-date"> ({formatEventDate(event.date)})</span>
                        </div>
                        {event.gps_enabled && <GpsTrackingToggle eventId={event.id} compact />}
                      </div>
                      <p className="events-upcoming-hint">촬영 감지를 ON으로 해주세요</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
