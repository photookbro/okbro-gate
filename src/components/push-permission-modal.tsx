'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ensurePushSubscription } from '@/lib/push-client'
import {
  detectMobilePlatform,
  dismissPushPrompt,
  getNotificationSettingsGuide,
  shouldShowPushPrompt,
  type MobilePlatform,
} from '@/lib/push-permission'
import { isFirstAppLaunchPending } from '@/lib/app-first-launch'
import { isStandaloneDisplayMode } from '@/lib/pwa-install'

type ModalStep = 'prompt' | 'settings'

export function PushPermissionModal() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ModalStep>('prompt')
  const [platform, setPlatform] = useState<MobilePlatform>('other')
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return
    if (isStandaloneDisplayMode() && isFirstAppLaunchPending()) return
    if (!shouldShowPushPrompt()) return

    setPlatform(detectMobilePlatform(navigator.userAgent))
    setStep('prompt')
    setOpen(true)
  }, [pathname])

  function handleDismiss() {
    dismissPushPrompt()
    setOpen(false)
  }

  async function handleEnable() {
    if (!('Notification' in window)) return

    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await ensurePushSubscription()
        setOpen(false)
        return
      }

      setPlatform(detectMobilePlatform(navigator.userAgent))
      setStep('settings')
    } finally {
      setRequesting(false)
    }
  }

  if (!open) return null

  const settingsGuide = getNotificationSettingsGuide(platform)

  return (
    <div className="modal-overlay z-[60]" onClick={handleDismiss}>
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="push-permission-title"
      >
        {step === 'prompt' ? (
          <>
            <h2 id="push-permission-title" className="section-title">
              📲 푸시 알림 안내
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-muted">
              푸시 알림을 켜면 촬영 지점 근처에서 알림을 받을 수 있어요!
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDismiss}
                disabled={requesting}
              >
                나중에
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleEnable()}
                disabled={requesting}
              >
                {requesting ? '요청 중...' : '설정으로 이동'}
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
            <button type="button" className="btn-primary" onClick={handleDismiss}>
              확인
            </button>
          </>
        )}
      </div>
    </div>
  )
}
