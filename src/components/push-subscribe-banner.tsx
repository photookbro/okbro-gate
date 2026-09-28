'use client'

import { useEffect, useState } from 'react'
import { isFirstAppLaunchPending } from '@/lib/app-first-launch'
import {
  ensurePushSubscription,
  PUSH_STATUS_CHANGED_EVENT,
  resolvePushClientStatus,
} from '@/lib/push-client'
import {
  PUSH_IOS_INSTALL_COPY,
  PUSH_IOS_INSTALL_STEPS,
  PUSH_NUDGE_COPY,
  isPushNudgeShownThisSession,
  markPushNudgeShownThisSession,
} from '@/lib/push-permission'

type BannerMode = 'hidden' | 'prompt' | 'ios'

/**
 * 앱 진입 시 세션당 1회: 권한 미응답(default) → 알림 받기, iOS 홈 화면 미추가 → 설치 안내.
 * 판별은 브라우저에서만 하고, 서버 요청은 「알림 받기」 클릭 시 구독 저장 1회뿐.
 */
export function PushSubscribeBanner() {
  const [mode, setMode] = useState<BannerMode>('hidden')
  const [requesting, setRequesting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // 첫 실행 온보딩에서 알림 권한을 따로 묻기 때문에 그 세션은 건너뜀
    if (isPushNudgeShownThisSession() || isFirstAppLaunchPending()) return

    let cancelled = false
    void resolvePushClientStatus().then(status => {
      if (cancelled) return
      const next: BannerMode =
        status === 'default' ? 'prompt' : status === 'ios_needs_install' ? 'ios' : 'hidden'
      if (next === 'hidden') return
      markPushNudgeShownThisSession()
      setMode(next)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode !== 'prompt') return
    const hideIfAnswered = () => {
      void resolvePushClientStatus().then(status => {
        if (status !== 'default') setMode('hidden')
      })
    }
    window.addEventListener(PUSH_STATUS_CHANGED_EVENT, hideIfAnswered)
    return () => window.removeEventListener(PUSH_STATUS_CHANGED_EVENT, hideIfAnswered)
  }, [mode])

  async function handleAllow() {
    setErrorMsg('')
    setRequesting(true)
    try {
      const ok = await ensurePushSubscription()
      if (ok) {
        setMode('hidden')
        return
      }
      setErrorMsg(
        Notification.permission === 'denied'
          ? '알림이 차단됐어요. 마이페이지의 알림 받기에서 설정 방법을 확인해주세요'
          : '알림을 켜지 못했어요. 다시 시도하거나 브라우저 설정을 확인해주세요'
      )
    } finally {
      setRequesting(false)
    }
  }

  if (mode === 'hidden') return null

  if (mode === 'ios') {
    return (
      <div className="push-denied-tip" role="status" aria-label="알림 받기 안내">
        <div className="push-denied-tip-inner">
          <p className="push-denied-tip-title">{PUSH_IOS_INSTALL_COPY}</p>
          <ul className="push-denied-tip-steps">
            {PUSH_IOS_INSTALL_STEPS.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <button type="button" className="push-denied-tip-dismiss" onClick={() => setMode('hidden')}>
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="push-subscribe-banner" role="region" aria-label="알림 받기 안내">
      <div className="push-subscribe-banner-inner">
        <p className="push-subscribe-banner-text">{PUSH_NUDGE_COPY}</p>
        <div className="push-subscribe-banner-actions">
          <button
            type="button"
            className="btn-secondary-inline"
            onClick={() => setMode('hidden')}
            disabled={requesting}
          >
            닫기
          </button>
          <button
            type="button"
            className="btn-primary-inline"
            onClick={() => void handleAllow()}
            disabled={requesting}
          >
            {requesting ? '요청 중...' : '알림 받기'}
          </button>
        </div>
        {errorMsg ? <p className="push-subscribe-banner-error">{errorMsg}</p> : null}
      </div>
    </div>
  )
}
