import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function EventsPage() {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: false })

  const typeLabel: Record<string, string> = {
    marathon: '🏃 마라톤',
    granfondo: '🚴 그란폰도',
    cycling: '🚵 사이클링',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          📋 대회 목록
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events?.map(event => (
            <Link key={event.id} href={`/events/${event.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '1.25rem', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '4px' }}>
                      {event.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      📅 {event.date} &nbsp;·&nbsp; 📍 {event.location}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '4px' }}>
                      {typeLabel[event.type] ?? event.type}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      📸 {event.photo_count.toLocaleString()}장
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}