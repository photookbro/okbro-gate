'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NotificationRecord } from '@/lib/notifications-server'
import {
  closeNotificationForSession,
  dismissNotificationToday,
  shouldShowNotificationBanner,
} from '@/lib/notification-dismiss'

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
    <section className="home-notification-thin" aria-labelledby="home-notification-title">
      <div className="home-notification-thin-inner">
        <span className="home-notification-thin-icon" aria-hidden="true">
          📢
        </span>
        <h2 id="home-notification-title" className="home-notification-thin-title">
          {notification.title}
        </h2>
        <button
          type="button"
          className="home-notification-thin-close"
          onClick={handleClose}
          aria-label="공지 닫기"
        >
          ✕
        </button>
      </div>
      <div className="home-notification-thin-actions">
        <Link href="/notification" className="home-notification-thin-link">
          전체 보기
        </Link>
        <span className="home-notification-thin-sep" aria-hidden="true">
          ·
        </span>
        <button type="button" onClick={handleDismissToday} className="home-notification-thin-dismiss">
          오늘 그만 보기
        </button>
      </div>
    </section>
  )
}
