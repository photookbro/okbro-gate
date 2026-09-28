'use client'

import { useState } from 'react'
import { ensurePushSubscription } from '@/lib/push-client'
import {
  PUSH_IOS_INSTALL_COPY,
  PUSH_IOS_INSTALL_STEPS,
  PUSH_NUDGE_COPY,
} from '@/lib/push-permission'
import { usePushClientStatus } from '@/lib/use-push-client-status'

/** 인증 결과 안내 옆에 붙는 알림 받기 유도 — 구독자·거부·미지원이면 아무것도 표시 안 함 */
export function PushSubscribeNudge({ className = '' }: { className?: string }) {
  const status = usePushClientStatus()
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubscribe() {
    setRequesting(true)
    setMessage('')
    try {
      const ok = await ensurePushSubscription()
      if (ok) {
        setMessage('알림을 받기 시작했어요')
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setMessage('알림이 차단됐어요. 브라우저 설정에서 허용해주세요')
      } else {
        setMessage('알림을 켜지 못했어요. 다시 시도해주세요')
      }
    } finally {
      setRequesting(false)
    }
  }

  if (message) {
    return <p className={`mb-0 text-sm text-muted ${className}`}>{message}</p>
  }

  if (status === 'ios_needs_install') {
    return (
      <div className={`push-nudge ${className}`}>
        <p className="push-nudge-text">{PUSH_IOS_INSTALL_COPY}</p>
        <ol className="push-nudge-steps">
          {PUSH_IOS_INSTALL_STEPS.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    )
  }

  if (status !== 'default' && status !== 'granted_unsubscribed') return null

  return (
    <div className={`push-nudge ${className}`}>
      <p className="push-nudge-text">{PUSH_NUDGE_COPY}</p>
      <button
        type="button"
        className="btn-primary-inline shrink-0"
        disabled={requesting}
        onClick={() => void handleSubscribe()}
      >
        {requesting ? '요청 중...' : '알림 받기'}
      </button>
    </div>
  )
}
