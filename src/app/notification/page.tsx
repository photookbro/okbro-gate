'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NotificationRecord } from '@/lib/notifications-server'

function formatNotificationDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationPage() {
  const [notification, setNotification] = useState<NotificationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/notifications/latest')
      .then(async res => {
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '공지를 불러오지 못했어요')
          return
        }
        setNotification(data.notification ?? null)
      })
      .catch(() => setError('공지를 불러오지 못했어요'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-shell notification-page">
      <div className="page-container-wide">
        <Link href="/" className="text-sm text-muted no-underline">
          ← 홈으로
        </Link>

        <h1 className="page-title mt-3">📢 NOTICE</h1>

        {loading && <p className="text-muted">로딩 중...</p>}
        {error && <p className="alert-danger">{error}</p>}

        {!loading && !error && !notification && (
          <p className="text-muted">등록된 공지가 없어요.</p>
        )}

        {notification ? (
          <article className="notification-page-card">
            <header className="notification-page-header">
              <h2 className="notification-page-title">{notification.title}</h2>
              <time className="text-sm text-muted" dateTime={notification.created_at}>
                {formatNotificationDateTime(notification.created_at)}
              </time>
            </header>
            <div className="notification-page-body">
              <p className="whitespace-pre-wrap leading-relaxed">{notification.content}</p>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  )
}
