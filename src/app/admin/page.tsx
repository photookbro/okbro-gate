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
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_meters: number | null
  gps_enabled: boolean | null
}

type EventForm = {
  name: string
  date: string
  album_a_url: string
  album_b_url: string
  gps_enabled: boolean
  gps_lat: string
  gps_lng: string
  gps_radius_meters: string
}

const emptyForm: EventForm = {
  name: '',
  date: '',
  album_a_url: '',
  album_b_url: '',
  gps_enabled: false,
  gps_lat: '',
  gps_lng: '',
  gps_radius_meters: '200',
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

const inputStyle = 'input-field'
const labelStyle = 'label-field'

function tabClass(active: boolean) {
  return active ? 'admin-tab admin-tab-active' : 'admin-tab'
}

export default function AdminPage() {
  const token = useAdminToken()
  const [tab, setTab] = useState<'events' | 'settings' | 'monitoring'>('events')
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventError, setEventError] = useState('')

  const [sharedOrderNumber, setSharedOrderNumber] = useState('')
  const [sharedOrderPeriodMonths, setSharedOrderPeriodMonths] = useState('')
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
    setSharedOrderPeriodMonths(data.shared_order_period_months ?? '1')
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
      gps_enabled: !!event.gps_enabled,
      gps_lat: event.gps_lat != null ? String(event.gps_lat) : '',
      gps_lng: event.gps_lng != null ? String(event.gps_lng) : '',
      gps_radius_meters: event.gps_radius_meters != null ? String(event.gps_radius_meters) : '200',
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
      gps_enabled: form.gps_enabled,
      gps_lat: form.gps_lat || null,
      gps_lng: form.gps_lng || null,
      gps_radius_meters: form.gps_radius_meters || 200,
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
        shared_order_period_months: sharedOrderPeriodMonths,
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
    setSharedOrderPeriodMonths(data.shared_order_period_months ?? '1')
    setVerifiedPeriodMonths(data.verified_period_months ?? '')
    setSettingsMsg('저장되었어요')
    setSavingSettings(false)
  }

  return (
    <div className="page-container-admin">
      <h1 className="page-title mb-6">⚙️ 관리자</h1>

      <div className="admin-tabs">
        {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={tabClass(tab === key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="admin-panel">
        {tab === 'events' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title mb-0">대회 목록</h2>
              <button type="button" onClick={openAddModal} className="btn-primary-inline">
                + 대회 추가
              </button>
            </div>

            {eventError && <p className="alert-danger">{eventError}</p>}

            {loadingEvents ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {['id', 'name', 'date', 'album_a_url', 'album_b_url', ''].map(col => (
                        <th key={col || 'actions'}>{col || '작업'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id}>
                        <td className="max-w-[120px] truncate text-muted">{event.id}</td>
                        <td className="font-medium">{event.name}</td>
                        <td className="whitespace-nowrap">{event.date}</td>
                        <td className="max-w-[180px] truncate text-muted">{event.album_a_url ?? '-'}</td>
                        <td className="max-w-[180px] truncate text-muted">{event.album_b_url ?? '-'}</td>
                        <td className="whitespace-nowrap">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditModal(event)} className="btn-secondary-inline px-3 py-1.5 text-xs">
                              수정
                            </button>
                            <button type="button" onClick={() => handleDeleteEvent(event.id)} className="btn-danger-inline px-3 py-1.5 text-xs">
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted">
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
            <h2 className="section-title">설정 관리</h2>

            {loadingSettings ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <form onSubmit={handleSaveSettings} className="max-w-md">
                <label className="mb-4 block">
                  <span className={labelStyle}>공동 인증번호 (shared_order_number)</span>
                  <input
                    value={sharedOrderNumber}
                    onChange={e => setSharedOrderNumber(e.target.value)}
                    className={inputStyle}
                  />
                </label>
                <label className="mb-4 block">
                  <span className={labelStyle}>공동 인증번호 유효기간 (shared_order_period_months, 개월)</span>
                  <input
                    type="number"
                    min={1}
                    value={sharedOrderPeriodMonths}
                    onChange={e => setSharedOrderPeriodMonths(e.target.value)}
                    className={inputStyle}
                  />
                </label>
                <label className="mb-4 block">
                  <span className={labelStyle}>구매 인증 유효기간 (verified_period_months, 개월)</span>
                  <input
                    type="number"
                    min={1}
                    value={verifiedPeriodMonths}
                    onChange={e => setVerifiedPeriodMonths(e.target.value)}
                    className={inputStyle}
                  />
                </label>

                {settingsError && <p className="alert-danger">{settingsError}</p>}
                {settingsMsg && <p className="alert-success">{settingsMsg}</p>}

                <button type="submit" disabled={savingSettings} className="btn-primary-inline">
                  {savingSettings ? '저장 중...' : '저장'}
                </button>
              </form>
            )}
          </>
        )}

        {tab === 'monitoring' && (
          <>
            <h2 className="section-title">모니터링</h2>

            {monitoringError && <p className="alert-danger">{monitoringError}</p>}

            {loadingMonitoring ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                  {[
                    { label: '총 인증 유저 수', value: monitorSummary?.total_verified_users ?? 0 },
                    { label: '현재 활성 유저 수', value: monitorSummary?.active_users ?? 0 },
                    { label: '만료 임박 유저 수 (30일 이내)', value: monitorSummary?.expiring_soon_users ?? 0 },
                    { label: '총 약관 동의 유저 수', value: monitorSummary?.total_terms_agreed_users ?? 0 },
                  ].map(card => (
                    <div key={card.label} className="card-section mb-0 text-center">
                      <p className="mb-1 text-xs text-muted">{card.label}</p>
                      <p className="text-2xl font-bold text-[var(--text)]">{card.value}</p>
                    </div>
                  ))}
                </div>

                <div className="card-section">
                  <h3 className="section-title mb-3 text-sm">
                    약관 동의 현황 ({termsAgreements.length}건)
                  </h3>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          {['이메일', '동의일시', '버전', 'IP'].map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {termsAgreements.map(row => (
                          <tr key={row.id}>
                            <td>{row.email}</td>
                            <td className="whitespace-nowrap text-muted">{formatDateTime(row.agreed_at)}</td>
                            <td className="text-muted">{row.version}</td>
                            <td className="font-mono text-xs text-muted">{row.ip_address}</td>
                          </tr>
                        ))}
                        {termsAgreements.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-muted">
                              약관 동의 기록이 없어요
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {monitorExpiringSoon.length > 0 && (
                  <div className="alert-warning mb-4">
                    <h3 className="section-title mb-3 text-sm text-amber-900">
                      만료 30일 이내 ({monitorExpiringSoon.length}명)
                    </h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr className="border-amber-200 bg-amber-50/50">
                            {['이메일', '대회', '만료일', '남은 기간', '알림'].map(col => (
                              <th key={col} className="text-amber-900">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {monitorExpiringSoon.map(user => (
                            <tr key={user.id} className="hover:bg-amber-50/80">
                              <td className="text-amber-950">{user.email}</td>
                              <td className="text-amber-950">{user.event_name ?? '-'}</td>
                              <td className="whitespace-nowrap text-amber-950">
                                {formatVerificationDate(user.expires_at)}
                              </td>
                              <td className="text-amber-950">{user.days_remaining ?? 0}일</td>
                              <td>
                                {user.notification_sent ? (
                                  <span className="text-xs font-semibold text-success">발송 완료</span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={notifyingOrderId === user.id}
                                    onClick={() => handleNotifyExpiry(user.id)}
                                    className="btn-primary-inline px-2.5 py-1.5 text-xs"
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

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {['이메일', '주문번호', '플랫폼', '인증일', '만료일', '상태'].map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monitorUsers.map(user => {
                        const rowClass =
                          user.status === 'expiring_soon'
                            ? 'bg-[var(--color-warning-bg)]'
                            : user.status === 'expired'
                              ? 'text-muted bg-[var(--bg)]/60'
                              : ''

                        return (
                          <tr key={user.id} className={rowClass}>
                            <td>{user.email}</td>
                            <td className="whitespace-nowrap">{user.order_number}</td>
                            <td>{user.platform}</td>
                            <td className="whitespace-nowrap">{formatVerificationDate(user.verified_at)}</td>
                            <td className="whitespace-nowrap">{formatVerificationDate(user.expires_at)}</td>
                            <td className="font-semibold">{STATUS_LABELS[user.status]}</td>
                          </tr>
                        )
                      })}
                      {monitorUsers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted">
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
          className="modal-overlay"
          onClick={() => !savingEvent && setModalOpen(false)}
        >
          <form
            onSubmit={handleSaveEvent}
            onClick={e => e.stopPropagation()}
            className="modal-card max-h-[90vh] max-w-md overflow-y-auto"
          >
            <h3 className="section-title">
              {editingId ? '대회 수정' : '대회 추가'}
            </h3>

            <label className="mb-3 block">
              <span className={labelStyle}>이름</span>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputStyle} />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>날짜</span>
              <input required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputStyle} />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>album_a_url</span>
              <input value={form.album_a_url} onChange={e => setForm(f => ({ ...f, album_a_url: e.target.value }))} className={inputStyle} />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>album_b_url</span>
              <input value={form.album_b_url} onChange={e => setForm(f => ({ ...f, album_b_url: e.target.value }))} className={inputStyle} />
            </label>

            <div className="card-section mb-4">
              <label className="mb-3 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.gps_enabled}
                  onChange={e => setForm(f => ({ ...f, gps_enabled: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-[var(--text)]">
                  GPS 감지 ON/OFF (gps_enabled)
                </span>
              </label>
              <label className="mb-3 block">
                <span className={labelStyle}>위도 (gps_lat)</span>
                <input
                  type="number"
                  step="any"
                  value={form.gps_lat}
                  onChange={e => setForm(f => ({ ...f, gps_lat: e.target.value }))}
                  className={inputStyle}
                  placeholder="37.5665"
                />
              </label>
              <label className="mb-3 block">
                <span className={labelStyle}>경도 (gps_lng)</span>
                <input
                  type="number"
                  step="any"
                  value={form.gps_lng}
                  onChange={e => setForm(f => ({ ...f, gps_lng: e.target.value }))}
                  className={inputStyle}
                  placeholder="126.9780"
                />
              </label>
              <label className="mb-0 block">
                <span className={labelStyle}>반경 (미터, gps_radius_meters)</span>
                <input
                  type="number"
                  min={1}
                  value={form.gps_radius_meters}
                  onChange={e => setForm(f => ({ ...f, gps_radius_meters: e.target.value }))}
                  className={inputStyle}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary-inline" disabled={savingEvent}>
                취소
              </button>
              <button type="submit" className="btn-primary-inline" disabled={savingEvent}>
                {savingEvent ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
