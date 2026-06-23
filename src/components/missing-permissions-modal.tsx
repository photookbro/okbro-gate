'use client'

import { useEffect, useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { PushPermissionPrompt } from '@/components/push-permission-prompt'
import {
  detectPlatform,
  findMissingRuntimePermissions,
  findPermissionGaps,
  getPermissionSnapshot,
  getStoredPermissionAck,
  isEventDetailRecheckDone,
  markEventDetailRecheckDone,
  setPermissionAck,
  syncPermissionAckFromSnapshot,
  type PermissionKind,
  type PermissionSnapshot,
} from '@/lib/app-permissions'
import {
  geolocationFailureMessage,
  queryGeolocationPermission,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'
import { ensurePushSubscription } from '@/lib/push-client'
import { getNotificationSettingsGuide } from '@/lib/push-permission'

type MissingPermissionsModalProps = {
  open: boolean
  missing: PermissionKind[]
  onResolved: () => void
  onDismiss: () => void
}

type View = 'summary' | 'gps-settings' | 'push-settings'

const PERMISSION_LABELS: Record<PermissionKind, string> = {
  gps: '위치(GPS)',
  notification: '알림',
}

export function MissingPermissionsModal({
  open,
  missing,
  onResolved,
  onDismiss,
}: MissingPermissionsModalProps) {
  const [view, setView] = useState<View>('summary')
  const [requesting, setRequesting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [gpsSettingsOpen, setGpsSettingsOpen] = useState(false)
  const [pushPromptOpen, setPushPromptOpen] = useState(false)
  const platform = detectPlatform()

  useEffect(() => {
    if (!open) {
      setView('summary')
      setErrorMessage('')
      setGpsSettingsOpen(false)
      setPushPromptOpen(false)
    }
  }, [open])

  if (!open || missing.length === 0) return null

  async function retryPermissions() {
    setRequesting(true)
    setErrorMessage('')

    try {
      let snapshot: PermissionSnapshot = await getPermissionSnapshot()

      if (missing.includes('gps') && snapshot.gps !== 'granted') {
        const result = await requestPreciseGeolocation()
        if (!result.granted) {
          const permission = await queryGeolocationPermission()
          if (permission === 'denied') {
            setGpsSettingsOpen(true)
            setErrorMessage(geolocationFailureMessage(result.reason))
            return
          }
          setErrorMessage(geolocationFailureMessage(result.reason))
          return
        }
        setPermissionAck('gps', true)
      }

      snapshot = await getPermissionSnapshot()

      if (missing.includes('notification') && snapshot.notification !== 'granted') {
        if (!('Notification' in window)) {
          setErrorMessage('이 브라우저는 알림을 지원하지 않아요')
          return
        }
        if (Notification.permission === 'denied') {
          setPushPromptOpen(true)
          setView('push-settings')
          setErrorMessage('알림 권한이 차단되어 있어요. 설정 안내를 확인해주세요.')
          return
        }
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          await ensurePushSubscription()
          setPermissionAck('notification', true)
        } else {
          setPushPromptOpen(true)
          setView('push-settings')
          return
        }
      }

      snapshot = await getPermissionSnapshot()
      syncPermissionAckFromSnapshot(snapshot)

      const stillMissing = findMissingRuntimePermissions(snapshot).filter(kind =>
        missing.includes(kind)
      )
      if (stillMissing.length === 0) {
        onResolved()
      }
    } finally {
      setRequesting(false)
    }
  }

  if (gpsSettingsOpen) {
    return (
      <GpsPermissionModal
        open
        mode="recheck"
        showSettingsGuide
        requesting={requesting}
        errorMessage={errorMessage}
        onAllow={() => void retryPermissions()}
        onDismiss={() => {
          setGpsSettingsOpen(false)
          onDismiss()
        }}
        showEmphasisNotice
        showBackgroundNotice
      />
    )
  }

  if (pushPromptOpen) {
    return (
      <PushPermissionPrompt
        open
        mode="recheck"
        showBackgroundNotice
        onComplete={() => {
          setPermissionAck('notification', Notification.permission === 'granted')
          setPushPromptOpen(false)
          void getPermissionSnapshot().then(snapshot => {
            const stillMissing = findMissingRuntimePermissions(snapshot).filter(kind =>
              missing.includes(kind)
            )
            if (stillMissing.length === 0) onResolved()
            else onDismiss()
          })
        }}
        onSkip={onDismiss}
      />
    )
  }

  if (view === 'push-settings') {
    const guide = getNotificationSettingsGuide(platform)
    return (
      <div className="modal-overlay z-[70]">
        <div className="modal-card max-w-md" role="dialog">
          <h2 className="section-title">{guide.title}</h2>
          <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            {guide.steps.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <button type="button" className="btn-primary w-full" onClick={onDismiss}>
            확인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-card max-w-md" role="dialog" aria-labelledby="missing-permissions-title">
        <h2 id="missing-permissions-title" className="section-title">
          필요한 권한이 없어요
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          촬영 감지와 알림을 위해 아래 권한이 필요해요.
        </p>
        <ul className="mb-4 space-y-2 text-sm text-[var(--text)]">
          {missing.map(kind => (
            <li key={kind}>• {PERMISSION_LABELS[kind]}</li>
          ))}
        </ul>
        {errorMessage ? <p className="alert-danger mb-4 text-sm">{errorMessage}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn-secondary" onClick={onDismiss} disabled={requesting}>
            나중에
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void retryPermissions()}
            disabled={requesting}
          >
            {requesting ? '요청 중...' : '다시 요청'}
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary mt-3 w-full"
          onClick={() => {
            if (missing.includes('gps')) {
              setGpsSettingsOpen(true)
              return
            }
            if (missing.includes('notification')) {
              setView('push-settings')
            }
          }}
        >
          설정 안내 보기
        </button>
      </div>
    </div>
  )
}

type EventPermissionGateProps = {
  children: React.ReactNode
  enabled: boolean
}

export function EventPermissionGate({ children, enabled }: EventPermissionGateProps) {
  const [checked, setChecked] = useState(false)
  const [missing, setMissing] = useState<PermissionKind[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setChecked(true)
      return
    }

    void (async () => {
      const snapshot = await getPermissionSnapshot()
      syncPermissionAckFromSnapshot(snapshot)

      if (!isEventDetailRecheckDone()) {
        const stored = getStoredPermissionAck()
        const issues = Array.from(
          new Set<PermissionKind>([
            ...findMissingRuntimePermissions(snapshot),
            ...findPermissionGaps(snapshot, stored),
          ])
        )
        if (issues.length > 0) {
          setMissing(issues)
          setShowModal(true)
        }
        markEventDetailRecheckDone()
      }

      setChecked(true)
    })()
  }, [enabled])

  if (!checked) {
    return <p className="text-sm text-muted">권한 확인 중...</p>
  }

  return (
    <>
      {children}
      <MissingPermissionsModal
        open={showModal}
        missing={missing}
        onResolved={() => setShowModal(false)}
        onDismiss={() => setShowModal(false)}
      />
    </>
  )
}
