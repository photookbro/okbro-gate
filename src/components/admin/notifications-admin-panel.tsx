'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NotificationRecord } from '@/lib/notifications-server'

type NotificationsAdminPanelProps = {
  token: string
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationsAdminPanel({ token }: NotificationsAdminPanelProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch('/api/admin/notifications')
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '목록을 불러오지 못했어요')
        return
      }
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
    } catch {
      setError('목록을 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await adminFetch('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '저장에 실패했어요')
        return
      }
      setTitle('')
      setContent('')
      setMessage('공지가 저장됐어요. 홈 화면에 최신 공지로 표시됩니다.')
      await loadNotifications()
    } catch {
      setError('저장에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <label className="block">
          <span className="label-field">공지 제목</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input-field"
            placeholder="예: 6월 대회 일정 안내"
            maxLength={200}
          />
        </label>

        <label className="block">
          <span className="label-field">공지 내용</span>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="input-field min-h-40 resize-y"
            placeholder="선수에게 전달할 내용을 입력해주세요"
            rows={8}
          />
        </label>

        {error && <p className="alert-danger">{error}</p>}
        {message && <p className="alert-success">{message}</p>}

        <button type="submit" disabled={saving} className="btn-primary-inline">
          {saving ? '저장 중...' : '공지 저장'}
        </button>
      </form>

      <section>
        <h3 className="section-title mb-3 text-base">최근 공지</h3>
        {loading ? (
          <p className="text-muted">로딩 중...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted">등록된 공지가 없어요</p>
        ) : (
          <ul className="space-y-3">
            {notifications.map(item => (
              <li key={item.id} className="card-section mb-0">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-[var(--text)]">{item.title}</p>
                  <time className="text-xs text-muted" dateTime={item.created_at}>
                    {formatCreatedAt(item.created_at)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                  {item.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
