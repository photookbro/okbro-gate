'use client'

import { useEffect, useState } from 'react'
import { ensurePushSubscription, hasActivePushSubscription } from '@/lib/push-client'
import {
  detectMobilePlatform,
  dismissPushDeniedTipForSession,
  dismissPushSubscribeBanner,
  getNotificationSettingsGuide,
  isPushDeniedTipSessionDismissed,
  recordPushSubscribeBannerImpression,
  shouldShowPushSubscribeBanner,
} from '@/lib/push-permission'

type BannerMode = 'hidden' | 'prompt' | 'denied'

export function PushSubscribeBanner() {
  const [mode, setMode] = useState<BannerMode>('hidden')
  const [requesting, setRequesting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      if (!('Notification' in window)) {
        if (!cancelled) setMode('hidden')
        return
      }

      const permission = Notification.permission

      if (permission === 'granted') {
        const subscribed = await hasActivePushSubscription()
        if (cancelled) return
        if (subscribed || !shouldShowPushSubscribeBanner()) {
          setMode('hidden')
          return
        }
        recordPushSubscribeBannerImpression()
        setMode('prompt')
        return
      }

      if (permission === 'denied') {
        if (isPushDeniedTipSessionDismissed()) {
          if (!cancelled) setMode('hidden')
          return
        }
        if (!cancelled) setMode('denied')
        return
      }

      // default — 아직 허용/거부 안 함
      if (!shouldShowPushSubscribeBanner()) {
        if (!cancelled) setMode('hidden')
        return
      }
      if (!cancelled) {
        recordPushSubscribeBannerImpression()
        setMode('prompt')
      }
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleAllow() {
    setErrorMsg('')
    setRequesting(true)
    try {
      const ok = await ensurePushSubscription()
      if (ok) {
        dismissPushSubscribeBanner()
        setMode('hidden')
        return
      }
      if (Notification.permission === 'denied') {
        setMode('denied')
        return
      }
      setErrorMsg('알림을 켜지 못했어요. 다시 시도하거나 브라우저 설정을 확인해주세요')
    } finally {
      setRequesting(false)
    }
  }

  function handleLater() {
    dismissPushSubscribeBanner()
    setMode('hidden')
  }

  function handleDismissDenied() {
    dismissPushDeniedTipForSession()
    setMode('hidden')
  }

  if (mode === 'hidden') return null

  if (mode === 'denied') {
    const guide = getNotificationSettingsGuide(
      detectMobilePlatform(typeof navigator !== 'undefined' ? navigator.userAgent : '')
    )
    return (
      <div className="push-denied-tip" role="status" aria-label="알림 설정 안내">
        <div className="push-denied-tip-inner">
          <p className="push-denied-tip-title">{guide.title}</p>
          <ul className="push-denied-tip-steps">
            {guide.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <button type="button" className="push-denied-tip-dismiss" onClick={handleDismissDenied}>
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="push-subscribe-banner" role="region" aria-label="대회 알림 구독 안내">
      <div className="push-subscribe-banner-inner">
        <p className="push-subscribe-banner-text">
          대회 소식 놓치지 마세요! 대회 임박 알림을 받아보세요
        </p>
        <div className="push-subscribe-banner-actions">
          <button
            type="button"
            className="btn-secondary-inline"
            onClick={handleLater}
            disabled={requesting}
          >
            나중에
          </button>
          <button
            type="button"
            className="btn-primary-inline"
            onClick={() => void handleAllow()}
            disabled={requesting}
          >
            {requesting ? '요청 중...' : '알림 허용'}
          </button>
        </div>
        {errorMsg ? <p className="push-subscribe-banner-error">{errorMsg}</p> : null}
      </div>
    </div>
  )
}
