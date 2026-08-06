'use client'
import { useState, useEffect, use, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import GpsDetector from '@/components/gps-detector'
import type { Event } from '@/types'

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'bib' | 'name'>('bib')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [event, setEvent] = useState<Event | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.from('events').select('*').eq('id', id).single()
      .then(({ data }) => setEvent(data))
  }, [id, supabase])

  async function handleSearch() {
    if (!query.trim()) return
    let data: any[] = []
    if (searchType === 'bib') {
      const bibNum = parseInt(query.trim())
      const tolerance = 100
      const { data: exact } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', id)
        .eq('bib_number', query.trim())

      const { data: similar } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', id)
        .neq('bib_number', query.trim())
        .gte('bib_number', String(bibNum - tolerance))
        .lte('bib_number', String(bibNum + tolerance))

      data = [...(exact ?? []), ...(similar ?? [])]
    } else {
      const { data: nameData } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', id)
        .ilike('participant_name', `%${query.trim()}%`)
      data = nameData ?? []
    }
    setResults(data ?? [])
    setSearched(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/events" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← 대회 목록
        </Link>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '1rem 0 0.25rem' }}>
          {event?.name ?? '로딩 중...'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          📅 {event?.date} &nbsp;·&nbsp; 📍 {event?.location}
        </p>

        {event && <GpsDetector event={event} />}

        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {(['bib', 'name'] as const).map(t => (
              <button key={t} onClick={() => setSearchType(t)} style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid',
                borderColor: searchType === t ? 'var(--accent)' : 'var(--border)',
                background: searchType === t ? 'var(--accent-dim)' : 'transparent',
                color: searchType === t ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.85rem',
              }}>
                {t === 'bib' ? '🔢 배번호' : '👤 이름'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={searchType === 'bib' ? '배번호 입력 (예: 1042)' : '이름 입력 (예: 김오켱)'}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '0.95rem', outline: 'none',
              }}
            />
            <button className="btn-primary" onClick={handleSearch}>검색</button>
          </div>
        </div>

        {searched && (
          results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
              검색 결과가 없어요 😢
            </p>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {results.length}장 발견
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {results.map(photo => (
                  <Link key={photo.id} href={`/photos/${photo.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ overflow: 'hidden', cursor: 'pointer' }}>
                      <div style={{ position: 'relative' }}>
                        <img src={photo.preview_url} alt="" style={{ width: '100%', display: 'block', filter: 'brightness(0.7)' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', fontWeight: 700, transform: 'rotate(-25deg)', letterSpacing: '2px' }}>
                            오켱GATE
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '0.75rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>BIB {photo.bib_number}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{photo.participant_name}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
