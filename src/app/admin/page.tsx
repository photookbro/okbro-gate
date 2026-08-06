'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import type { Event } from '@/types'

type EventForm = {
  name: string
  date: string
  location: string
  type: Event['type']
  drive_folder_id: string
  cover_image_url: string
  gps_enabled: boolean
  gps_lat: string
  gps_lng: string
  gps_radius_meters: string
}

const emptyForm: EventForm = {
  name: '',
  date: '',
  location: '',
  type: 'marathon',
  drive_folder_id: '',
  cover_image_url: '',
  gps_enabled: false,
  gps_lat: '',
  gps_lng: '',
  gps_radius_meters: '200',
}

function toForm(event: Event): EventForm {
  return {
    name: event.name,
    date: event.date,
    location: event.location,
    type: event.type,
    drive_folder_id: event.drive_folder_id,
    cover_image_url: event.cover_image_url ?? '',
    gps_enabled: event.gps_enabled ?? false,
    gps_lat: event.gps_lat != null ? String(event.gps_lat) : '',
    gps_lng: event.gps_lng != null ? String(event.gps_lng) : '',
    gps_radius_meters: String(event.gps_radius_meters ?? 200),
  }
}

function toPayload(form: EventForm) {
  return {
    name: form.name,
    date: form.date,
    location: form.location,
    type: form.type,
    drive_folder_id: form.drive_folder_id,
    cover_image_url: form.cover_image_url || null,
    gps_enabled: form.gps_enabled,
    gps_lat: form.gps_lat ? parseFloat(form.gps_lat) : null,
    gps_lng: form.gps_lng ? parseFloat(form.gps_lng) : null,
    gps_radius_meters: parseInt(form.gps_radius_meters, 10) || 200,
  }
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  outline: 'none',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '4px',
}

export default function AdminPage() {
  const [tab, setTab] = useState<'events'>('events')
  const [events, setEvents] = useState<Event[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadEvents() {
    const res = await fetch('/api/admin/events')
    if (res.ok) setEvents(await res.json())
  }

  useEffect(() => {
    loadEvents()
  }, [])

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setMessage('')
  }

  function startEdit(event: Event) {
    setEditingId(event.id)
    setForm(toForm(event))
    setMessage('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const payload = toPayload(form)
    const url = editingId
      ? `/api/admin/events/${editingId}`
      : '/api/admin/events'
    const method = editingId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMessage(`오류: ${data.error}`)
      return
    }

    setMessage(editingId ? '수정되었습니다.' : '추가되었습니다.')
    setForm(emptyForm)
    setEditingId(null)
    loadEvents()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 대회를 삭제할까요?')) return
    const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (editingId === id) startCreate()
      loadEvents()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
          ← 홈
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0' }}>
          ⚙️ 관리자
        </h1>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setTab('events')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: tab === 'events' ? 'var(--accent)' : 'var(--border)',
              background: tab === 'events' ? 'var(--accent-dim)' : 'transparent',
              color: tab === 'events' ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            대회 관리
          </button>
        </div>

        {tab === 'events' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>대회 목록</h2>
                <button type="button" className="btn-primary" onClick={startCreate} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  + 추가
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {events.map(event => (
                  <div key={event.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{event.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {event.date} · {event.location}
                        {event.gps_enabled && ' · 📍 GPS ON'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => startEdit(event)} style={{ fontSize: '0.75rem', cursor: 'pointer' }}>수정</button>
                      <button type="button" onClick={() => handleDelete(event.id)} style={{ fontSize: '0.75rem', cursor: 'pointer', color: '#ef4444' }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                {editingId ? '대회 수정' : '대회 추가'}
              </h2>

              {[
                { key: 'name', label: '대회명' },
                { key: 'date', label: '날짜', type: 'date' },
                { key: 'location', label: '장소' },
                { key: 'drive_folder_id', label: 'Drive 폴더 ID' },
                { key: 'cover_image_url', label: '커버 이미지 URL' },
              ].map(({ key, label, type }) => (
                <div key={key} style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    type={type ?? 'text'}
                    value={form[key as keyof EventForm] as string}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    style={inputStyle}
                    required={['name', 'date', 'location', 'drive_folder_id'].includes(key)}
                  />
                </div>
              ))}

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>종목</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as Event['type'] })}
                  style={inputStyle}
                >
                  <option value="marathon">마라톤</option>
                  <option value="granfondo">그란폰도</option>
                  <option value="cycling">사이클링</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>GPS 설정</h3>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.gps_enabled}
                    onChange={e => setForm({ ...form, gps_enabled: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.85rem' }}>GPS 감지 ON/OFF</span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>위도 (gps_lat)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_lat}
                      onChange={e => setForm({ ...form, gps_lat: e.target.value })}
                      placeholder="37.5665"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>경도 (gps_lng)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_lng}
                      onChange={e => setForm({ ...form, gps_lng: e.target.value })}
                      placeholder="126.9780"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>반경 (미터)</label>
                  <input
                    type="number"
                    value={form.gps_radius_meters}
                    onChange={e => setForm({ ...form, gps_radius_meters: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {message && (
                <p style={{ fontSize: '0.85rem', color: message.startsWith('오류') ? '#ef4444' : 'var(--green)', marginTop: '0.75rem' }}>
                  {message}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
                {loading ? '저장 중...' : editingId ? '수정 저장' : '대회 추가'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
