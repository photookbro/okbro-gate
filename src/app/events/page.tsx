import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function EventsPage() {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, date, album_a_url, album_b_url, gps_lat, gps_lng')
    .order('date', { ascending: false })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          📋 대회 목록
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events?.map(event => {
            const albumCount = [event.album_a_url, event.album_b_url].filter(Boolean).length
            const hasGps = event.gps_lat != null && event.gps_lng != null

            return (
              <Link key={event.id} href={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '4px' }}>
                        {event.name}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        📅 {event.date}
                        {hasGps && (
                          <>
                            &nbsp;·&nbsp; 📍 {event.gps_lat}, {event.gps_lng}
                          </>
                        )}
                      </div>
                    </div>
                    {albumCount > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          📷 앨범 {albumCount}개
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
