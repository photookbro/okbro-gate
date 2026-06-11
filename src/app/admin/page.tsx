'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAdminToken } from './admin-auth-context'
import { formatVerificationDate } from '@/lib/order-verification'

type Event = {
  id: string
  name: string
  date: string
  album_a_url: string | null
  album_b_url: string | null
}

type EventForm = {
  name: string
  date: string
  album_a_url: string
  album_b_url: string
}

const emptyForm: EventForm = {
  name: '',
  date: '',
  album_a_url: '',
  album_b_url: '',
}

type MonitorStatus = 'active' | 'expired' | 'expiring_soon'

type MonitorUser = {
  id: string
  email: string
  order_number: string
  platform: string
  event_name?: string
  verified_at: string | null
  expires_at: string | null
  days_remaining?: number
  status: MonitorStatus
  notification_sent?: boolean
}

type MonitorSummary = {
  total_verified_users: number
  active_users: number
  expiring_soon_users: number
  total_terms_agreed_users: number
}

type TermsAgreementRow = {
  id: string
  email: string
  agreed_at: string | null
  version: string
  ip_address: string
}

const TAB_LABELS = {
  events: '대회 관리',
  settings: '설정 관리',
  monitoring: '모니터링',
} as const

const STATUS_LABELS: Record<MonitorStatus, string> = {
  active: '활성',
  expiring_soon: '임박',
  expired: '만료',
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '0.9rem',
  outline: 'none',
}

const btnStyle = (variant: 'primary' | 'secondary' | 'danger' = 'primary'): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: '8px',
  border: variant === 'secondary' ? '1px solid #d1d5db' : 'none',
  backgroundColor: variant === 'primary' ? '#2563eb' : variant === 'danger' ? '#ef4444' : '#ffffff',
  color: variant === 'secondary' ? '#374151' : '#ffffff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
})

export default function AdminPage() {
  const token = useAdminToken()
  const [tab, setTab] = useState<'events' | 'settings' | 'monitoring'>('events')
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventError, setEventError] = useState('')

  const [sharedOrderNumber, setSharedOrderNumber] = useState('')
  const [verifiedPeriodMonths, setVerifiedPeriodMonths] = useState('')
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [savingEvent, setSavingEvent] = useState(false)

  const [monitorSummary, setMonitorSummary] = useState<MonitorSummary | null>(null)
  const [monitorUsers, setMonitorUsers] = useState<MonitorUser[]>([])
  const [monitorExpiringSoon, setMonitorExpiringSoon] = useState<MonitorUser[]>([])
  const [termsAgreements, setTermsAgreements] = useState<TermsAgreementRow[]>([])
  const [loadingMonitoring, setLoadingMonitoring] = useState(false)
  const [monitoringError, setMonitoringError] = useState('')
  const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null)

  const adminFetch = useCallback(
    (url: string, options: RequestInit = {}) =>
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          ...options.headers,
        },
      }),
    [token]
  )

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    setEventError('')
    const res = await adminFetch('/api/admin/events')
    const data = await res.json()
    if (!res.ok) {
      setEventError(data.error ?? '대회 목록을 불러오지 못했어요')
      setLoadingEvents(false)
      return
    }
    setEvents(data.events ?? [])
    setLoadingEvents(false)
  }, [adminFetch])

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    setSettingsError('')
    const res = await adminFetch('/api/admin/settings')
    const data = await res.json()
    if (!res.ok) {
      setSettingsError(data.error ?? '설정을 불러오지 못했어요')
      setLoadingSettings(false)
      return
    }
    setSharedOrderNumber(data.shared_order_number ?? '')
    setVerifiedPeriodMonths(data.verified_period_months ?? '')
    setLoadingSettings(false)
  }, [adminFetch])

  const loadMonitoring = useCallback(async () => {
    setLoadingMonitoring(true)
    setMonitoringError('')
    const res = await adminFetch('/api/admin/monitoring')
    const data = await res.json()
    if (!res.ok) {
      setMonitoringError(data.error ?? '모니터링 데이터를 불러오지 못했어요')
      setLoadingMonitoring(false)
      return
    }
    setMonitorSummary(data.summary ?? null)
    setMonitorUsers(data.users ?? [])
    setMonitorExpiringSoon(data.expiring_soon ?? [])
    setTermsAgreements(data.terms_agreements ?? [])
    setLoadingMonitoring(false)
  }, [adminFetch])

  async function handleNotifyExpiry(orderId: string) {
    setNotifyingOrderId(orderId)
    setMonitoringError('')

    const res = await adminFetch('/api/admin/monitoring/notify', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId }),
    })
    const data = await res.json()

    setNotifyingOrderId(null)

    if (!res.ok) {
      setMonitoringError(data.error ?? '알림 발송 실패')
      return
    }

    setMonitorExpiringSoon(prev =>
      prev.map(row =>
        row.id === orderId ? { ...row, notification_sent: true } : row
      )
    )
    setMonitorUsers(prev =>
      prev.map(row =>
        row.id === orderId ? { ...row, notification_sent: true } : row
      )
    )
  }

  useEffect(() => {
    loadEvents()
    loadSettings()
  }, [loadEvents, loadSettings])

  useEffect(() => {
    if (tab === 'monitoring') {
      loadMonitoring()
    }
  }, [tab, loadMonitoring])

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEditModal(event: Event) {
    setEditingId(event.id)
    setForm({
      name: event.name,
      date: event.date,
      album_a_url: event.album_a_url ?? '',
      album_b_url: event.album_b_url ?? '',
    })
    setModalOpen(true)
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault()
    setSavingEvent(true)
    setEventError('')

    const body = JSON.stringify({
      name: form.name,
      date: form.date,
      album_a_url: form.album_a_url,
      album_b_url: form.album_b_url,
    })

    const res = editingId
      ? await adminFetch(`/api/admin/events?id=${editingId}`, { method: 'PUT', body })
      : await adminFetch('/api/admin/events', { method: 'POST', body })

    const data = await res.json()
    if (!res.ok) {
      setEventError(data.error ?? '저장 실패')
      setSavingEvent(false)
      return
    }

    setModalOpen(false)
    setSavingEvent(false)
    await loadEvents()
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('이 대회를 삭제할까요?')) return

    const res = await adminFetch(`/api/admin/events?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setEventError(data.error ?? '삭제 실패')
      return
    }
    await loadEvents()
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsError('')
    setSettingsMsg('')

    const res = await adminFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        shared_order_number: sharedOrderNumber,
        verified_period_months: verifiedPeriodMonths,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setSettingsError(data.error ?? '저장 실패')
      setSavingSettings(false)
      return
    }

    setSharedOrderNumber(data.shared_order_number ?? '')
    setVerifiedPeriodMonths(data.verified_period_months ?? '')
    setSettingsMsg('저장되었어요')
    setSavingSettings(false)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem' }}>
        ⚙️ 관리자
      </h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              ...btnStyle(tab === key ? 'primary' : 'secondary'),
              padding: '10px 18px',
            }}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
        }}
      >
        {tab === 'events' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>대회 목록</h2>
              <button type="button" onClick={openAddModal} style={btnStyle('primary')}>
                + 대회 추가
              </button>
            </div>

            {eventError && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{eventError}</p>
            )}

            {loadingEvents ? (
              <p style={{ color: '#6b7280' }}>로딩 중...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['id', 'name', 'date', 'album_a_url', 'album_b_url', ''].map(col => (
                        <th
                          key={col || 'actions'}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: '#374151',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col || '작업'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.id}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500 }}>{event.name}</td>
                        <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{event.date}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.album_a_url ?? '-'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.album_b_url ?? '-'}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" onClick={() => openEditModal(event)} style={btnStyle('secondary')}>
                              수정
                            </button>
                            <button type="button" onClick={() => handleDeleteEvent(event.id)} style={btnStyle('danger')}>
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                          등록된 대회가 없어요
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'settings' && (
          <>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: '0 0 1rem' }}>설정 관리</h2>

            {loadingSettings ? (
              <p style={{ color: '#6b7280' }}>로딩 중...</p>
            ) : (
              <form onSubmit={handleSaveSettings} style={{ maxWidth: '480px' }}>
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                    공동 인증번호 (shared_order_number)
                  </span>
                  <input
                    value={sharedOrderNumber}
                    onChange={e => setSharedOrderNumber(e.target.value)}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                    인증 기간 (verified_period_months, 개월)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={verifiedPeriodMonths}
                    onChange={e => setVerifiedPeriodMonths(e.target.value)}
                    style={inputStyle}
                  />
                </label>

                {settingsError && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{settingsError}</p>
                )}
                {settingsMsg && (
                  <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{settingsMsg}</p>
                )}

                <button type="submit" disabled={savingSettings} style={btnStyle('primary')}>
                  {savingSettings ? '저장 중...' : '저장'}
                </button>
              </form>
            )}
          </>
        )}

        {tab === 'monitoring' && (
          <>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: '0 0 1rem' }}>모니터링</h2>

            {monitoringError && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{monitoringError}</p>
            )}

            {loadingMonitoring ? (
              <p style={{ color: '#6b7280' }}>로딩 중...</p>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  {[
                    { label: '총 인증 유저 수', value: monitorSummary?.total_verified_users ?? 0 },
                    { label: '현재 활성 유저 수', value: monitorSummary?.active_users ?? 0 },
                    { label: '만료 임박 유저 수 (30일 이내)', value: monitorSummary?.expiring_soon_users ?? 0 },
                    { label: '총 약관 동의 유저 수', value: monitorSummary?.total_terms_agreed_users ?? 0 },
                  ].map(card => (
                    <div
                      key={card.label}
                      style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb',
                      }}
                    >
                      <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', color: '#6b7280' }}>{card.label}</p>
                      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{card.value}</p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' }}>
                    약관 동의 현황 ({termsAgreements.length}건)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          {['이메일', '동의일시', '버전', 'IP'].map(col => (
                            <th
                              key={col}
                              style={{
                                padding: '8px 10px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: '#374151',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {termsAgreements.map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px 10px', color: '#111827' }}>{row.email}</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>
                              {formatDateTime(row.agreed_at)}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#6b7280' }}>{row.version}</td>
                            <td style={{ padding: '8px 10px', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {row.ip_address}
                            </td>
                          </tr>
                        ))}
                        {termsAgreements.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                              약관 동의 기록이 없어요
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {monitorExpiringSoon.length > 0 && (
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid #fde68a',
                      backgroundColor: '#fffbeb',
                    }}
                  >
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 0.75rem' }}>
                      만료 30일 이내 ({monitorExpiringSoon.length}명)
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #fde68a' }}>
                            {['이메일', '대회', '만료일', '남은 기간', '알림'].map(col => (
                              <th
                                key={col}
                                style={{
                                  padding: '8px 10px',
                                  textAlign: 'left',
                                  fontWeight: 600,
                                  color: '#92400e',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {monitorExpiringSoon.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                              <td style={{ padding: '8px 10px', color: '#78350f' }}>{user.email}</td>
                              <td style={{ padding: '8px 10px', color: '#78350f' }}>{user.event_name ?? '-'}</td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#78350f' }}>
                                {formatVerificationDate(user.expires_at)}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#78350f' }}>
                                {user.days_remaining ?? 0}일
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {user.notification_sent ? (
                                  <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}>
                                    발송 완료
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={notifyingOrderId === user.id}
                                    onClick={() => handleNotifyExpiry(user.id)}
                                    style={{
                                      ...btnStyle('primary'),
                                      padding: '6px 10px',
                                      fontSize: '0.8rem',
                                      opacity: notifyingOrderId === user.id ? 0.6 : 1,
                                    }}
                                  >
                                    {notifyingOrderId === user.id ? '발송 중...' : '알림 발송'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {['이메일', '주문번호', '플랫폼', '인증일', '만료일', '상태'].map(col => (
                          <th
                            key={col}
                            style={{
                              padding: '10px 12px',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: '#374151',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monitorUsers.map(user => {
                        const rowStyle: React.CSSProperties =
                          user.status === 'expiring_soon'
                            ? { backgroundColor: '#fffbeb' }
                            : user.status === 'expired'
                              ? { backgroundColor: '#f9fafb', color: '#9ca3af' }
                              : {}

                        return (
                          <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6', ...rowStyle }}>
                            <td style={{ padding: '10px 12px' }}>{user.email}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{user.order_number}</td>
                            <td style={{ padding: '10px 12px' }}>{user.platform}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              {formatVerificationDate(user.verified_at)}
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              {formatVerificationDate(user.expires_at)}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              {STATUS_LABELS[user.status]}
                            </td>
                          </tr>
                        )
                      })}
                      {monitorUsers.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                            인증 기록이 없어요
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
          onClick={() => !savingEvent && setModalOpen(false)}
        >
          <form
            onSubmit={handleSaveEvent}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '480px',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: '#111827' }}>
              {editingId ? '대회 수정' : '대회 추가'}
            </h3>

            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>이름</span>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>날짜</span>
              <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.75rem' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>album_a_url</span>
              <input value={form.album_a_url} onChange={e => setForm(f => ({ ...f, album_a_url: e.target.value }))} style={inputStyle} />
            </label>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>album_b_url</span>
              <input value={form.album_b_url} onChange={e => setForm(f => ({ ...f, album_b_url: e.target.value }))} style={inputStyle} />
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalOpen(false)} style={btnStyle('secondary')} disabled={savingEvent}>
                취소
              </button>
              <button type="submit" style={btnStyle('primary')} disabled={savingEvent}>
                {savingEvent ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
