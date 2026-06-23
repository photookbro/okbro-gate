'use client'

import { useState } from 'react'
import { BackgroundGpsNotice } from '@/components/background-gps-notice'
import { ensurePushSubscription } from '@/lib/push-client'
import {
  detectMobilePlatform,
  getNotificationSettingsGuide,
  type MobilePlatform,
} from '@/lib/push-permission'

export type PushPermissionPromptMode = 'standalone' | 'onboarding' | 'recheck'

type PushPermissionPromptProps = {
  open: boolean
  mode?: PushPermissionPromptMode
  onComplete: () => void
  onSkip?: () => void
  showBackgroundNotice?: boolean
}

type ModalStep = 'prompt' | 'settings'

export function PushPermissionPrompt({
  open,
  mode = 'standalone',
  onComplete,
  onSkip,
  showBackgroundNotice = true,
}: PushPermissionPromptProps) {
  const [step, setStep] = useState<ModalStep>('prompt')
  const [platform, setPlatform] = useState<MobilePlatform>('other')
  const [requesting, setRequesting] = useState(false)

  if (!open) return null

  const settingsGuide = getNotificationSettingsGuide(platform)
  const isOnboarding = mode === 'onboarding'

  async function handleEnable() {
    if (!('Notification' in window)) {
      onComplete()
      return
    }

    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await ensurePushSubscription()
        onComplete()
        return
      }

      setPlatform(detectMobilePlatform(navigator.userAgent))
      setStep('settings')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="modal-overlay z-[70]" onClick={isOnboarding ? undefined : onComplete}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="push-permission-title"
      >
        {step === 'prompt' ? (
          <>
            <h2 id="push-permission-title" className="section-title">
              🔔 촬영 알림을 받으시겠어요?
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              촬영 지점 근처에 도착하거나 촬영이 완료되면 알림을 보내드려요.
            </p>
            {showBackgroundNotice ? (
              <div className="mb-4">
                <BackgroundGpsNotice compact />
              </div>
            ) : null}
            <div className="btn-row">
              {onSkip ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onSkip}
                  disabled={requesting}
                >
                  나중에
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onComplete}
                  disabled={requesting}
                >
                  나중에
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleEnable()}
                disabled={requesting}
              >
                {requesting ? '요청 중...' : '알림 허용'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="push-permission-title" className="section-title">
              {settingsGuide.title}
            </h2>
            <p className="mb-3 text-sm text-muted">
              브라우저에서 알림이 차단되어 있어요. 아래 순서대로 설정을 켜주세요.
            </p>
            <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--text)]">
              {settingsGuide.steps.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <button type="button" className="btn-primary w-full" onClick={onComplete}>
              확인
            </button>
          </>
        )}
      </div>
    </div>
  )
}
