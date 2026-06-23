'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NotificationRecord } from '@/lib/notifications-server'
import {
  closeNotificationForSession,
  dismissNotificationToday,
  shouldShowNotificationBanner,
} from '@/lib/notification-dismiss'

function formatNotificationDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function HomeNotificationBanner() {
  const [notification, setNotification] = useState<NotificationRecord | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/notifications/latest')
      .then(async res => {
        const data = await res.json()
        if (cancelled || !res.ok) return
        const item = data.notification as NotificationRecord | null
        if (!item?.id) return
        if (!shouldShowNotificationBanner(item.id)) return
        setNotification(item)
        setVisible(true)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleClose() {
    if (!notification) return
    closeNotificationForSession(notification.id)
    setVisible(false)
  }

  function handleDismissToday() {
    if (!notification) return
    dismissNotificationToday(notification.id)
    setVisible(false)
  }

  if (loading || !visible || !notification) return null

  return (
    <section className="home-notification-banner" aria-labelledby="home-notification-title">
      <div className="home-notification-banner-inner">
        <div className="home-notification-banner-header">
          <div>
            <p className="home-notification-banner-label">📢 공지</p>
            <h2 id="home-notification-title" className="home-notification-banner-title">
              {notification.title}
            </h2>
            {notification.created_at ? (
              <time className="home-notification-banner-date" dateTime={notification.created_at}>
                {formatNotificationDate(notification.created_at)}
              </time>
            ) : null}
          </div>
          <button
            type="button"
            className="home-notification-close"
            onClick={handleClose}
            aria-label="공지 닫기"
          >
            ✕
          </button>
        </div>

        <div className="home-notification-banner-body">
          <p className="home-notification-banner-content">{notification.content}</p>
        </div>

        <div className="home-notification-banner-actions">
          <Link href="/notification" className="home-notification-link">
            전체 보기
          </Link>
          <button type="button" onClick={handleDismissToday} className="home-notification-dismiss">
            오늘 그만 보기
          </button>
        </div>
      </div>
    </section>
  )
}
