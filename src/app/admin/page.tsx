'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminToken } from './admin-auth-context'
import { AdminDateInput } from '@/components/admin-date-input'
import { EventPhotoUpload } from '@/components/admin/event-photo-upload'
import { NotificationsAdminPanel } from '@/components/admin/notifications-admin-panel'
import {
  AdminGpsLocationMap,
  type GpsMapSlot,
} from '@/components/admin/admin-gps-location-map'
import { isCompleteIsoDate, isPastIsoDate } from '@/lib/date-input'

type Event = {
  id: string
  name: string
  date: string
  album_a_url: string | null
  album_b_url: string | null
  photo_url: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_meters: number | null
  gps_1_lat: number | null
  gps_1_lng: number | null
  gps_1_radius_meters: number | null
  gps_2_lat: number | null
  gps_2_lng: number | null
  gps_2_radius_meters: number | null
  gps_enabled: boolean | null
  is_loop_course: boolean | null
}

type EventForm = {
  name: string
  date: string
  album_a_url: string
  album_b_url: string
  gps_enabled: boolean
  is_loop_course: boolean
  gps_1_lat: string
  gps_1_lng: string
  gps_1_radius_meters: string
  gps_2_lat: string
  gps_2_lng: string
  gps_2_radius_meters: string
}

const emptyForm: EventForm = {
  name: '',
  date: '',
  album_a_url: '',
  album_b_url: '',
  gps_enabled: false,
  is_loop_course: false,
  gps_1_lat: '',
  gps_1_lng: '',
  gps_1_radius_meters: '50',
  gps_2_lat: '',
  gps_2_lng: '',
  gps_2_radius_meters: '50',
}

type PlayerRow = {
  id: string
  name: string
  email: string
  joined_at: string
  joined_at_display: string
  terms_agreed: boolean
  purchase_verified: boolean
  gps_record: boolean
  verified_at_display: string
  expires_at_display: string
  days_remaining: number | null
  photo_access_days_remaining: number
  last_activity: string | null
  last_activity_display: string
}

type PlayerDetail = {
  id: string
  name: string
  email: string
  joined_at: string
  joined_at_display: string
  terms: {
    agreed: boolean
    agreed_at: string | null
    agreed_at_display: string | null
    version: string | null
  }
  event_history: {
    event_id: string
    name: string
    date: string
    passed: boolean
    gps_pass_count: number
    is_loop_course: boolean
    location_count: number
    course_label: string
    max_passes: number
    locations: {
      location_number: number
      label: string
      passes: {
        pass_count: number
        passed_at_display: string | null
        notified: boolean | null
      }[]
    }[]
  }[]
  tracking_prefs: {
    event_id: string
    name: string
    date: string
    enabled: boolean
  }[]
  orders: {
    id: string
    order_number: string
    platform: string
    event_name: string
    verified_at_display: string
    expires_at_display: string
    validity_period_display: string
    status: string
    is_valid: boolean
    is_duplicate: boolean
    duplicate_count: number
    duplicate_users: { user_id: string; email: string }[]
  }[]
}

type EventMonitorRow = {
  id: string
  user_id: string | null
  player_label: string
  gps_tracking_on: boolean
  gps_passed: boolean
  passed_at: string | null
  passed_at_display: string | null
  pass_count: number | null
  location_number: number | null
  notified: boolean
}

const TAB_LABELS = {
  events: 'MANAGE EVENTS',
  settings: 'SETTINGS',
  players: 'PLAYERS',
  event_monitoring: 'MONITORING',
} as const

function formatDateOnly(date: string | null | undefined): string {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const inputStyle = 'input-field'
const labelStyle = 'label-field'

function tabClass(active: boolean) {
  return active ? 'admin-tab admin-tab-active' : 'admin-tab'
}

function OxBadge({ value }: { value: boolean }) {
  return (
    <span className={`font-semibold ${value ? 'text-success' : 'text-muted'}`}>
      {value ? 'O' : 'X'}
    </span>
  )
}

export default function AdminPage() {
  const token = useAdminToken()
  const [tab, setTab] = useState<'events' | 'settings' | 'players' | 'event_monitoring'>('events')
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventError, setEventError] = useState('')

  const [verifiedPeriodDays, setVerifiedPeriodDays] = useState('')
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settingsError, setSettingsError] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventSavedMsg, setEventSavedMsg] = useState('')
  const formSnapshotRef = useRef<EventForm>(emptyForm)
  const [gpsMapSlot, setGpsMapSlot] = useState<GpsMapSlot>(1)
  const [gpsMapSaving, setGpsMapSaving] = useState(false)
  const [gpsMapMessage, setGpsMapMessage] = useState('')
  const [gpsMapError, setGpsMapError] = useState('')


  const [gpsLogsModalEvent, setGpsLogsModalEvent] = useState<{ id: string; name: string } | null>(null)
  const [gpsLogs, setGpsLogs] = useState<
    { id: string; user_name: string; passed_at_display: string; notified: boolean }[]
  >([])
  const [loadingGpsLogs, setLoadingGpsLogs] = useState(false)
  const [gpsLogsError, setGpsLogsError] = useState('')
  const [notifyingEventId, setNotifyingEventId] = useState<string | null>(null)

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [playersError, setPlayersError] = useState('')
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null)
  const [loadingPlayerDetail, setLoadingPlayerDetail] = useState(false)
  const [playerDetailError, setPlayerDetailError] = useState('')
  const [revokingAccess, setRevokingAccess] = useState(false)
  const [expandedGpsEventId, setExpandedGpsEventId] = useState<string | null>(null)
  const [duplicateModalUsers, setDuplicateModalUsers] = useState<
    { user_id: string; email: string }[]
  >([])
  const [duplicateModalOrderNumber, setDuplicateModalOrderNumber] = useState('')

  const [eventMonitorEventId, setEventMonitorEventId] = useState('')
  const [eventMonitorRows, setEventMonitorRows] = useState<EventMonitorRow[]>([])
  const [loadingEventMonitoring, setLoadingEventMonitoring] = useState(false)
  const [eventMonitoringError, setEventMonitoringError] = useState('')
  const [sendingEventNotify, setSendingEventNotify] = useState(false)

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
    setVerifiedPeriodDays(data.verified_period_days ?? '')
    setLoadingSettings(false)
  }, [adminFetch])

  const loadEventMonitoring = useCallback(
    async (eventId: string) => {
      if (!eventId) {
        setEventMonitorRows([])
        return
      }
      setLoadingEventMonitoring(true)
      setEventMonitoringError('')
      const res = await adminFetch(`/api/admin/event-monitoring?event_id=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (!res.ok) {
        setEventMonitoringError(data.error ?? '대회별 모니터링 데이터를 불러오지 못했어요')
        setEventMonitorRows([])
        setLoadingEventMonitoring(false)
        return
      }
      setEventMonitorRows(data.rows ?? [])
      setLoadingEventMonitoring(false)
    },
    [adminFetch]
  )

  async function handleSendEventMonitorNotify() {
    if (!eventMonitorEventId) return

    const pendingCount = eventMonitorRows.filter(row => row.gps_passed && !row.notified).length
    if (pendingCount === 0) {
      alert('발송할 대상이 없어요 (이미 발송된 기록뿐이에요)')
      return
    }

    if (!confirm(`미발송 ${pendingCount}명에게 알림을 보내시겠습니까?`)) return

    setSendingEventNotify(true)
    try {
      const res = await adminFetch('/api/gps-notify', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventMonitorEventId }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? '발송 실패')
        return
      }

      await loadEventMonitoring(eventMonitorEventId)

      const parts = [`${data.pending}명 중 ${data.notified}명 발송 완료`]
      if (data.no_subscription > 0) parts.push(`${data.no_subscription}명은 알림 미구독 상태`)
      if (data.push_failed > 0) parts.push(`${data.push_failed}건 발송 실패`)
      alert(`${parts.join(', ')}입니다`)
    } finally {
      setSendingEventNotify(false)
    }
  }

  const loadPlayers = useCallback(async () => {
    setLoadingPlayers(true)
    setPlayersError('')
    const res = await adminFetch('/api/admin/players')
    const data = await res.json()
    if (!res.ok) {
      setPlayersError(data.error ?? '선수 목록을 불러오지 못했어요')
      setLoadingPlayers(false)
      return
    }
    setPlayers(data.players ?? [])
    setLoadingPlayers(false)
  }, [adminFetch])

  async function openPlayerDetail(userId: string) {
    setPlayerDetail(null)
    setPlayerDetailError('')
    setExpandedGpsEventId(null)
    setLoadingPlayerDetail(true)

    const res = await adminFetch(`/api/admin/players?user_id=${encodeURIComponent(userId)}`)
    const data = await res.json()

    setLoadingPlayerDetail(false)

    if (!res.ok) {
      setPlayerDetailError(data.error ?? '선수 정보를 불러오지 못했어요')
      return
    }

    setPlayerDetail(data.player ?? null)
  }

  async function handleRevokeAccess(userId: string) {
    if (!confirm('이 선수의 사진 열람 권한을 강제로 0으로 만들까요? (기존 구매 인증이 모두 즉시 만료돼요)')) {
      return
    }

    setRevokingAccess(true)
    const res = await adminFetch('/api/admin/players/revoke-access', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    })
    const data = await res.json()
    setRevokingAccess(false)

    if (!res.ok) {
      alert(data.error ?? '강제 만료 실패')
      return
    }

    await openPlayerDetail(userId)
    await loadPlayers()
  }

  function closePlayerDetail() {
    setPlayerDetail(null)
    setPlayerDetailError('')
    setExpandedGpsEventId(null)
  }

  async function openGpsLogsModal(event: Event) {
    setGpsLogsModalEvent({ id: event.id, name: event.name })
    setGpsLogs([])
    setGpsLogsError('')
    setLoadingGpsLogs(true)

    const res = await adminFetch(`/api/admin/gps-logs?event_id=${encodeURIComponent(event.id)}`)
    const data = await res.json()

    setLoadingGpsLogs(false)

    if (!res.ok) {
      setGpsLogsError(data.error ?? 'GPS 로그 조회 실패')
      return
    }

    setGpsLogs(data.logs ?? [])
  }

  function closeGpsLogsModal() {
    setGpsLogsModalEvent(null)
    setGpsLogs([])
    setGpsLogsError('')
  }

  async function handleSendGpsNotify(event: Event) {
    setNotifyingEventId(event.id)
    try {
      const countRes = await adminFetch(`/api/admin/gps-logs?event_id=${encodeURIComponent(event.id)}`)
      const countData = await countRes.json()
      if (!countRes.ok) {
        alert(countData.error ?? 'GPS 로그 조회 실패')
        return
      }

      const pendingCount = (countData.logs ?? []).filter(
        (log: { notified: boolean }) => !log.notified
      ).length

      if (pendingCount === 0) {
        alert('발송할 대상이 없어요 (이미 발송된 기록뿐이에요)')
        return
      }

      if (!confirm(`${pendingCount}명에게 발송하시겠습니까?`)) return

      const res = await adminFetch('/api/gps-notify', {
        method: 'POST',
        body: JSON.stringify({ event_id: event.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? '발송 실패')
        return
      }

      alert(
        `발송 완료 — 성공 ${data.notified}건 · 구독 없음 ${data.no_subscription}건 · 실패 ${data.push_failed}건`
      )
    } finally {
      setNotifyingEventId(null)
    }
  }

  useEffect(() => {
    loadEvents()
    loadSettings()
  }, [loadEvents, loadSettings])

  useEffect(() => {
    if (tab === 'players') {
      loadPlayers()
    }
    if (tab === 'event_monitoring' && eventMonitorEventId) {
      loadEventMonitoring(eventMonitorEventId)
    }
  }, [tab, loadPlayers, loadEventMonitoring, eventMonitorEventId])

  const eventDateIsPast = isPastIsoDate(form.date)

  useEffect(() => {
    if (eventDateIsPast && form.gps_enabled) {
      setForm(f => ({ ...f, gps_enabled: false }))
    }
  }, [eventDateIsPast, form.gps_enabled])

  function openAddModal() {
    setEditingId(null)
    setForm(emptyForm)
    formSnapshotRef.current = emptyForm
    setGpsMapSlot(1)
    setGpsMapMessage('')
    setGpsMapError('')
    setEventSavedMsg('')
    setModalOpen(true)
  }

  function openEditModal(event: Event) {
    setEditingId(event.id)
    setEventSavedMsg('')
    setGpsMapSlot(1)
    setGpsMapMessage('')
    setGpsMapError('')
    const nextForm: EventForm = {
      name: event.name,
      date: event.date,
      album_a_url: event.album_a_url ?? '',
      album_b_url: event.album_b_url ?? '',
      gps_enabled: !!event.gps_enabled,
      is_loop_course: event.is_loop_course === true,
      gps_1_lat:
        event.gps_1_lat != null
          ? String(event.gps_1_lat)
          : event.gps_lat != null
            ? String(event.gps_lat)
            : '',
      gps_1_lng:
        event.gps_1_lng != null
          ? String(event.gps_1_lng)
          : event.gps_lng != null
            ? String(event.gps_lng)
            : '',
      gps_1_radius_meters:
        event.gps_1_radius_meters != null
          ? String(event.gps_1_radius_meters)
          : event.gps_radius_meters != null
            ? String(event.gps_radius_meters)
            : '50',
      gps_2_lat: event.gps_2_lat != null ? String(event.gps_2_lat) : '',
      gps_2_lng: event.gps_2_lng != null ? String(event.gps_2_lng) : '',
      gps_2_radius_meters:
        event.gps_2_radius_meters != null ? String(event.gps_2_radius_meters) : '50',
    }
    setForm(nextForm)
    formSnapshotRef.current = nextForm
    setModalOpen(true)
  }

  function isEventFormDirty() {
    return JSON.stringify(form) !== JSON.stringify(formSnapshotRef.current)
  }

  function requestCloseEventModal() {
    if (savingEvent) return
    if (isEventFormDirty() && !confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) {
      return
    }
    setModalOpen(false)
  }

  useEffect(() => {
    if (!modalOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        requestCloseEventModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, form, savingEvent])

  function buildEventPayloadFromForm(
    sourceForm: EventForm = form,
    overrides?: Partial<Record<string, unknown>>
  ) {
    return {
      name: sourceForm.name,
      date: sourceForm.date,
      album_a_url: sourceForm.album_a_url,
      album_b_url: sourceForm.album_b_url,
      gps_enabled: sourceForm.gps_enabled,
      is_loop_course: sourceForm.is_loop_course,
      gps_1_lat: sourceForm.gps_1_lat || null,
      gps_1_lng: sourceForm.gps_1_lng || null,
      gps_1_radius_meters: sourceForm.gps_1_radius_meters || 50,
      gps_2_lat: sourceForm.gps_2_lat || null,
      gps_2_lng: sourceForm.gps_2_lng || null,
      gps_2_radius_meters: sourceForm.gps_2_radius_meters || 50,
      ...overrides,
    }
  }

  async function handleApplyGpsLocation(slot: GpsMapSlot, lat: string, lng: string) {
    setGpsMapSaving(true)
    setGpsMapMessage('')
    setGpsMapError('')

    const nextForm: EventForm =
      slot === 1
        ? { ...form, gps_1_lat: lat, gps_1_lng: lng }
        : { ...form, gps_2_lat: lat, gps_2_lng: lng }

    setForm(nextForm)

    if (!editingId) {
      setGpsMapMessage(`${slot}차 촬영 위치가 폼에 반영됐어요. 대회 저장을 눌러주세요.`)
      setGpsMapSaving(false)
      return
    }

    const res = await adminFetch(`/api/admin/events?id=${editingId}`, {
      method: 'PUT',
      body: JSON.stringify(buildEventPayloadFromForm(nextForm)),
    })

    const data = await res.json()
    if (!res.ok) {
      setGpsMapError(typeof data.error === 'string' ? data.error : '위치 저장에 실패했어요')
      setGpsMapSaving(false)
      return
    }

    setGpsMapMessage(`${slot}차 촬영 위치가 저장됐어요.`)
    setGpsMapSaving(false)
    await loadEvents()
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!isCompleteIsoDate(form.date)) {
      setEventError('날짜 형식이 올바르지 않아요. 예: 20250608')
      return
    }

    setSavingEvent(true)
    setEventError('')
    setEventSavedMsg('')

    const body = JSON.stringify(buildEventPayloadFromForm())
    const isNewEvent = !editingId

    const res = editingId
      ? await adminFetch(`/api/admin/events?id=${editingId}`, { method: 'PUT', body })
      : await adminFetch('/api/admin/events', { method: 'POST', body })

    const data = await res.json()
    if (!res.ok) {
      setEventError(data.error ?? '저장 실패')
      setSavingEvent(false)
      return
    }

    setSavingEvent(false)
    formSnapshotRef.current = form
    await loadEvents()

    if (isNewEvent && data.event?.id) {
      // 신규 대회는 저장 직후에도 모달을 열어둬서 바로 사진을 업로드할 수 있게 함
      setEditingId(data.event.id)
      setEventSavedMsg('대회가 저장됐어요. 아래에서 대회 사진을 업로드할 수 있어요.')
      return
    }

    setModalOpen(false)
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
        verified_period_days: verifiedPeriodDays,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setSettingsError(data.error ?? '저장 실패')
      setSavingSettings(false)
      return
    }

    setVerifiedPeriodDays(data.verified_period_days ?? '')

    setSettingsMsg(
      typeof data.purchase_orders_extended === 'number' && data.purchase_orders_extended > 0
        ? `저장되었어요. 유효 중인 구매인증 ${data.purchase_orders_extended}건 만료일을 연장했어요.`
        : '저장되었어요'
    )
    setSavingSettings(false)
  }

  return (
    <div className="page-container-admin">
      <h1 className="page-title">⚙️ 관리자</h1>

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
              <h2 className="section-title mb-0">EVENTS</h2>
              <button type="button" onClick={openAddModal} className="btn-primary-inline">
                + 대회 추가
              </button>
            </div>

            {eventError && <p className="alert-danger">{eventError}</p>}

            {loadingEvents ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-event-table">
                  <thead>
                    <tr>
                      <th>대회명</th>
                      <th>날짜</th>
                      <th>저화소 앨범</th>
                      <th>고화질 앨범</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id}>
                        <td className="font-medium whitespace-nowrap">{event.name}</td>
                        <td className="whitespace-nowrap text-[var(--text-muted)]">{event.date}</td>
                        <td className="max-w-[220px] truncate text-[var(--text-muted)]" title={event.album_a_url ?? undefined}>
                          {event.album_a_url ?? '-'}
                        </td>
                        <td className="max-w-[220px] truncate text-[var(--text-muted)]" title={event.album_b_url ?? undefined}>
                          {event.album_b_url ?? '-'}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="admin-event-row-actions">
                            <button
                              type="button"
                              onClick={() => void openGpsLogsModal(event)}
                              className="btn-secondary-inline"
                            >
                              GPS 로그
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSendGpsNotify(event)}
                              disabled={notifyingEventId === event.id}
                              className="btn-secondary-inline btn-notify"
                            >
                              {notifyingEventId === event.id ? '발송 중...' : '종료 후 알림 발송'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(event)}
                              className="btn-secondary-inline"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="btn-danger-inline"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {events.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted">
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
            <h2 className="section-title">SETTINGS</h2>

            <section className="card-section">
              <h3 className="mb-3 text-base font-semibold text-[var(--text)]">일반 설정</h3>

              {loadingSettings ? (
                <p className="text-muted">로딩 중...</p>
              ) : (
                <form onSubmit={handleSaveSettings} className="max-w-md">
                  <label className="mb-4 block">
                    <span className={labelStyle}>구매 인증 유효기간 (일)</span>
                    <input
                      type="number"
                      min={1}
                      value={verifiedPeriodDays}
                      onChange={e => setVerifiedPeriodDays(e.target.value)}
                      className={inputStyle}
                    />
                  </label>

                  {settingsError && <p className="alert-danger">{settingsError}</p>}
                  {settingsMsg && <p className="alert-success">{settingsMsg}</p>}

                  <button type="submit" disabled={savingSettings} className="btn-primary-inline">
                    {savingSettings ? '저장 중...' : 'SAVE'}
                  </button>
                </form>
              )}
            </section>

            <section className="card-section">
              <h3 className="mb-3 text-base font-semibold text-[var(--text)]">NOTICE</h3>
              <p className="mb-4 text-sm text-muted">
                저장한 공지는 선수 홈 화면에 최신 1건이 배너로 표시됩니다.
              </p>
              <NotificationsAdminPanel token={token} />
            </section>
          </>
        )}

        {tab === 'players' && (
          <>
            <h2 className="section-title">PLAYERS</h2>
            <p className="mb-4 text-sm text-muted">
              약관 동의·구매 인증·GPS 기록을 한곳에서 확인할 수 있어요. 행을 클릭하면 상세 프로필을 볼 수 있어요.
            </p>

            {playersError && <p className="alert-danger">{playersError}</p>}

            {loadingPlayers ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <>
                <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {[
                        '이름',
                        '이메일',
                        '가입일',
                        '약관 동의',
                        '구매 인증',
                        'GPS 기록',
                        '구매 인증일',
                        '구매 만료일',
                        '열람 가능(합산)',
                        '마지막 활동',
                      ].map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(player => (
                      <tr
                        key={player.id}
                        className="cursor-pointer hover:bg-[var(--bg)]/80"
                        onClick={() => void openPlayerDetail(player.id)}
                      >
                        <td className="font-medium">{player.name}</td>
                        <td>{player.email}</td>
                        <td className="whitespace-nowrap text-muted">{formatDateOnly(player.joined_at)}</td>
                        <td><OxBadge value={player.terms_agreed} /></td>
                        <td><OxBadge value={player.purchase_verified} /></td>
                        <td><OxBadge value={player.gps_record} /></td>
                        <td className="whitespace-nowrap text-muted">{player.verified_at_display}</td>
                        <td className="whitespace-nowrap text-muted">{player.expires_at_display}</td>
                        <td className="whitespace-nowrap font-medium">
                          {player.photo_access_days_remaining > 0
                            ? `${player.photo_access_days_remaining}일`
                            : '0일'}
                        </td>
                        <td className="whitespace-nowrap text-muted">{formatDateOnly(player.last_activity)}</td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted">
                          등록된 선수가 없어요
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

        {tab === 'event_monitoring' && (
          <>
            <h2 className="section-title">MONITORING</h2>

            <div className="mb-4 max-w-md">
              <label htmlFor="event-monitor-select" className={labelStyle}>
                대회 선택
              </label>
              <select
                id="event-monitor-select"
                value={eventMonitorEventId}
                onChange={e => {
                  const nextId = e.target.value
                  setEventMonitorEventId(nextId)
                  if (nextId) loadEventMonitoring(nextId)
                  else setEventMonitorRows([])
                }}
                className={inputStyle}
              >
                <option value="">대회를 선택하세요</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({formatDateOnly(event.date)})
                  </option>
                ))}
              </select>
            </div>

            {eventMonitoringError && <p className="alert-danger">{eventMonitoringError}</p>}

            {eventMonitorEventId && !loadingEventMonitoring && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => void handleSendEventMonitorNotify()}
                  disabled={sendingEventNotify}
                  className="btn-primary-inline"
                >
                  {sendingEventNotify ? '발송 중...' : '📣 NOTIFY ALL'}
                </button>
              </div>
            )}

            {!eventMonitorEventId ? (
              <p className="text-sm text-muted">GPS 통과 현황을 보려면 대회를 선택하세요.</p>
            ) : loadingEventMonitoring ? (
              <p className="text-muted">로딩 중...</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {[
                        '선수명',
                        'GPS 감지',
                        'GPS 통과',
                        '통과 시각',
                        'pass_count',
                        'notified',
                      ].map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {eventMonitorRows.map(row => (
                      <tr key={row.id}>
                        <td>{row.player_label}</td>
                        <td>
                          <OxBadge value={row.gps_tracking_on === true} />
                        </td>
                        <td>
                          <OxBadge value={row.gps_passed} />
                        </td>
                        <td className="whitespace-nowrap">
                          {row.passed_at_display ?? '-'}
                        </td>
                        <td>
                          {row.pass_count != null ? `${row.pass_count}차` : '-'}
                        </td>
                        <td>
                          {row.gps_passed ? (
                            row.notified ? (
                              <span className="text-xs font-semibold text-success">발송</span>
                            ) : (
                              <span className="text-xs text-muted">미발송</span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                    {eventMonitorRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted">
                          GPS 감지 ON / 통과 로그 / 구매 인증 선수가 없어요
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <form
            onSubmit={handleSaveEvent}
            onClick={e => e.stopPropagation()}
            className="modal-card admin-event-modal max-h-[90vh] overflow-y-auto"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="section-title mb-0">
                {editingId ? '대회 수정' : '대회 추가'}
              </h3>
              <button
                type="button"
                onClick={requestCloseEventModal}
                disabled={savingEvent}
                aria-label="닫기"
                className="btn-secondary-inline px-2.5 py-1.5 text-sm"
              >
                ✕
              </button>
            </div>

            <label className="mb-3 block">
              <span className={labelStyle}>대회명</span>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputStyle} />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>날짜</span>
              <AdminDateInput
                required
                value={form.date}
                onChange={date => setForm(f => ({ ...f, date }))}
                className={inputStyle}
              />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>저화소 앨범 URL</span>
              <input value={form.album_a_url} onChange={e => setForm(f => ({ ...f, album_a_url: e.target.value }))} className={inputStyle} />
            </label>
            <label className="mb-3 block">
              <span className={labelStyle}>고화질 앨범 URL</span>
              <input value={form.album_b_url} onChange={e => setForm(f => ({ ...f, album_b_url: e.target.value }))} className={inputStyle} />
            </label>

            {editingId ? (
              <>
                {eventSavedMsg && <p className="alert-success">{eventSavedMsg}</p>}
                <EventPhotoUpload
                  token={token}
                  eventId={editingId}
                  photoUrl={events.find(e => e.id === editingId)?.photo_url ?? null}
                  onChange={photoUrl => {
                    setEvents(prev =>
                      prev.map(e => (e.id === editingId ? { ...e, photo_url: photoUrl } : e))
                    )
                  }}
                />
              </>
            ) : (
              <p className="mb-4 text-xs text-muted">대회를 먼저 저장하면 사진을 업로드할 수 있어요</p>
            )}

            <div className="card-section mb-4">
              <label className="mb-1 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.gps_enabled}
                  disabled={eventDateIsPast}
                  onChange={e => setForm(f => ({ ...f, gps_enabled: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-[var(--text)]">GPS 감지</span>
              </label>
              {eventDateIsPast && (
                <p className="mb-3 text-xs text-muted">
                  지난 대회는 GPS 감지를 켤 수 없어요
                </p>
              )}
              <label className="mb-4 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_loop_course}
                  onChange={e => setForm(f => ({ ...f, is_loop_course: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-[var(--text)]">순환 코스</span>
              </label>

              <AdminGpsLocationMap
                visible={modalOpen}
                activeSlot={gpsMapSlot}
                onActiveSlotChange={setGpsMapSlot}
                slot1Lat={form.gps_1_lat}
                slot1Lng={form.gps_1_lng}
                slot2Lat={form.gps_2_lat}
                slot2Lng={form.gps_2_lng}
                onApply={handleApplyGpsLocation}
                applying={gpsMapSaving}
                statusMessage={gpsMapMessage}
                statusError={gpsMapError}
              />

              <div className="admin-gps-location-grid">
                <div className="admin-gps-location-card">
                  <p className="admin-gps-location-title">1차 촬영</p>
                  <label className="mb-3 block">
                    <span className={labelStyle}>위도</span>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_1_lat}
                      onChange={e => setForm(f => ({ ...f, gps_1_lat: e.target.value }))}
                      className={inputStyle}
                      placeholder="37.5665"
                    />
                  </label>
                  <label className="mb-3 block">
                    <span className={labelStyle}>경도</span>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_1_lng}
                      onChange={e => setForm(f => ({ ...f, gps_1_lng: e.target.value }))}
                      className={inputStyle}
                      placeholder="126.9780"
                    />
                  </label>
                  <label className="mb-0 block">
                    <span className={labelStyle}>반경</span>
                    <input
                      type="number"
                      min={1}
                      value={form.gps_1_radius_meters}
                      onChange={e => setForm(f => ({ ...f, gps_1_radius_meters: e.target.value }))}
                      className={inputStyle}
                    />
                  </label>
                </div>

                <div className="admin-gps-location-card">
                  <p className="admin-gps-location-title">2차 촬영</p>
                  <label className="mb-3 block">
                    <span className={labelStyle}>위도</span>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_2_lat}
                      onChange={e => setForm(f => ({ ...f, gps_2_lat: e.target.value }))}
                      className={inputStyle}
                      placeholder="선택 입력"
                    />
                  </label>
                  <label className="mb-3 block">
                    <span className={labelStyle}>경도</span>
                    <input
                      type="number"
                      step="any"
                      value={form.gps_2_lng}
                      onChange={e => setForm(f => ({ ...f, gps_2_lng: e.target.value }))}
                      className={inputStyle}
                      placeholder="선택 입력"
                    />
                  </label>
                  <label className="mb-0 block">
                    <span className={labelStyle}>반경</span>
                    <input
                      type="number"
                      min={1}
                      value={form.gps_2_radius_meters}
                      onChange={e => setForm(f => ({ ...f, gps_2_radius_meters: e.target.value }))}
                      className={inputStyle}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={requestCloseEventModal} className="btn-secondary-inline" disabled={savingEvent}>
                취소
              </button>
              <button type="submit" className="btn-primary-inline" disabled={savingEvent}>
                {savingEvent ? '저장 중...' : 'SAVE'}
              </button>
            </div>
          </form>
        </div>
      )}

      {gpsLogsModalEvent && (
        <div className="modal-overlay" onClick={closeGpsLogsModal}>
          <div className="modal-card max-w-lg" onClick={e => e.stopPropagation()}>
            <h3 className="section-title">📍 GPS 로그 — {gpsLogsModalEvent.name}</h3>

            {loadingGpsLogs && <p className="text-sm text-muted">로딩 중...</p>}
            {gpsLogsError && <p className="alert-danger">{gpsLogsError}</p>}

            {!loadingGpsLogs && !gpsLogsError && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {['유저', '통과 시각', 'notified'].map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gpsLogs.map(log => (
                      <tr key={log.id}>
                        <td className="font-medium">{log.user_name}</td>
                        <td className="whitespace-nowrap">{log.passed_at_display}</td>
                        <td>{log.notified ? '✅ 발송됨' : '⏳ 대기'}</td>
                      </tr>
                    ))}
                    {gpsLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-muted">
                          GPS 로그가 없어요
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <button type="button" onClick={closeGpsLogsModal} className="btn-primary mt-4 w-full">
              닫기
            </button>
          </div>
        </div>
      )}

      {(playerDetail || loadingPlayerDetail || playerDetailError) && (
        <div className="modal-overlay" onClick={closePlayerDetail}>
          <div
            className="modal-card max-h-[90vh] max-w-lg overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {loadingPlayerDetail && <p className="text-sm text-muted">로딩 중...</p>}
            {playerDetailError && <p className="alert-danger">{playerDetailError}</p>}

            {playerDetail && (
              <>
                <h3 className="section-title">{playerDetail.name}</h3>
                <p className="mb-4 text-sm text-muted">{playerDetail.email}</p>

                <section className="card-section mb-4">
                  <h4 className="mb-2 text-sm font-semibold">📋 기본 정보</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">이름</dt>
                      <dd className="font-medium">{playerDetail.name}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">이메일</dt>
                      <dd>{playerDetail.email}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">가입일</dt>
                      <dd>{playerDetail.joined_at_display}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">약관 동의</dt>
                      <dd>
                        {playerDetail.terms.agreed ? (
                          <>
                            O{' '}
                            {playerDetail.terms.agreed_at && (
                              <span className="text-muted">({formatDateOnly(playerDetail.terms.agreed_at)})</span>
                            )}
                          </>
                        ) : (
                          'X'
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="card-section mb-4">
                  <h4 className="mb-2 text-sm font-semibold">🎯 대회 이력 · GPS 로그</h4>
                  {playerDetail.event_history.length === 0 ? (
                    <p className="text-sm text-muted">지난 대회 기록이 없어요</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {playerDetail.event_history.map(event => {
                        const hasPassDetail = event.locations.some(
                          location => location.passes.length > 0
                        )
                        const expanded = hasPassDetail && expandedGpsEventId === event.event_id
                        return (
                          <li key={event.event_id}>
                            <button
                              type="button"
                              className="flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--bg)] disabled:cursor-default disabled:hover:bg-transparent"
                              onClick={() =>
                                hasPassDetail &&
                                setExpandedGpsEventId(expanded ? null : event.event_id)
                              }
                              disabled={!hasPassDetail}
                            >
                              <span className="text-muted">
                                {hasPassDetail ? (expanded ? '▼' : '▶') : '·'}
                              </span>
                              <span className="font-medium">{event.name}</span>
                              <span className="text-muted">({event.date})</span>
                              {event.course_label && (
                                <span className="text-xs text-muted">{event.course_label}</span>
                              )}
                              {event.passed ? (
                                <span className="text-xs text-success">
                                  ✅ GPS {event.gps_pass_count}회
                                </span>
                              ) : (
                                <span className="text-xs text-muted">❌ 미출전</span>
                              )}
                            </button>
                            {expanded && (
                              <div className="ml-6 mt-2 space-y-3 border-l border-[var(--border)] pl-3 text-sm">
                                {event.locations.map(location => (
                                  <div key={location.location_number}>
                                    <p className="mb-1 font-medium text-[var(--text)]">
                                      [{location.label}]
                                    </p>
                                    <ul className="space-y-1">
                                      {location.passes.map(slot => (
                                        <li key={slot.pass_count} className="text-[var(--text)]">
                                          {slot.pass_count}차:{' '}
                                          {slot.passed_at_display ? (
                                            <>
                                              {slot.passed_at_display}{' '}
                                              <span className="text-muted">
                                                (notified: {slot.notified ? 'O' : 'X'})
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-muted">(없음)</span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                <section className="card-section mb-4">
                  <h4 className="mb-2 text-sm font-semibold">🔔 촬영 감지</h4>
                  {playerDetail.tracking_prefs.length === 0 ? (
                    <p className="text-sm text-muted">예정된 대회가 없어요</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {playerDetail.tracking_prefs.map(pref => (
                        <li key={pref.event_id} className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{pref.name}</span>
                          <span className="text-muted">(예정)</span>
                          <span className={pref.enabled ? 'font-semibold text-success' : 'text-muted'}>
                            [{pref.enabled ? 'ON' : 'OFF'}]
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card-section mb-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">💰 구매 인증</h4>
                    <button
                      type="button"
                      className="btn-danger-inline"
                      disabled={revokingAccess}
                      onClick={() => void handleRevokeAccess(playerDetail.id)}
                    >
                      {revokingAccess ? '처리 중...' : '🚫 열람 강제 만료'}
                    </button>
                  </div>
                  {playerDetail.orders.length === 0 ? (
                    <p className="text-sm text-muted">구매 인증 기록이 없어요</p>
                  ) : (
                    <div className="space-y-3">
                      {playerDetail.orders.map(order => (
                        <div key={order.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted">주문번호</span>
                            <span className="flex items-center gap-2 font-medium">
                              {order.order_number}
                              {order.is_duplicate ? (
                                <button
                                  type="button"
                                  className="cursor-pointer border-0 bg-transparent p-0 text-sm"
                                  onClick={() => {
                                    setDuplicateModalOrderNumber(order.order_number)
                                    setDuplicateModalUsers(order.duplicate_users)
                                  }}
                                >
                                  ⚠️ (중복 {order.duplicate_count}개)
                                </button>
                              ) : (
                                <span className="text-success">✅</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between gap-4">
                            <span className="text-muted">유효기간</span>
                            <span>{order.validity_period_display}</span>
                          </div>
                          <div className="mt-1 flex justify-between gap-4">
                            <span className="text-muted">상태</span>
                            <span className={order.is_valid ? 'font-semibold text-success' : 'text-muted'}>
                              {order.is_valid ? '✅' : ''} {order.status}
                            </span>
                          </div>
                          {order.event_name && order.event_name !== '전체 이용권' && (
                            <div className="mt-1 flex justify-between gap-4">
                              <span className="text-muted">대회</span>
                              <span>{order.event_name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            <button type="button" onClick={closePlayerDetail} className="btn-primary mt-2 w-full">
              닫기
            </button>
          </div>
        </div>
      )}

      {duplicateModalUsers.length > 0 && (
        <div className="modal-overlay" onClick={() => setDuplicateModalUsers([])}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-semibold">중복 주문번호</h3>
            <p className="mb-4 text-sm text-muted">
              <span className="font-medium text-[var(--text)]">{duplicateModalOrderNumber}</span>
              를 사용 중인 다른 계정:
            </p>
            <ul className="mb-4 space-y-2 text-sm">
              {duplicateModalUsers.map(user => (
                <li key={user.user_id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                  {user.email}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setDuplicateModalUsers([])}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
