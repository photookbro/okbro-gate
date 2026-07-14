'use client'

import { useEffect, useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import {
  findPermissionGaps,
  getPermissionSnapshot,
  getStoredPermissionAck,
  isEventDetailRecheckDone,
  isGpsPermissionGranted,
  markEventDetailRecheckDone,
  setPermissionAck,
  syncPermissionAckFromSnapshot,
} from '@/lib/app-permissions'
import {
  geolocationFailureMessage,
  queryGeolocationPermission,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'

type MissingPermissionsModalProps = {
  open: boolean
  onResolved: () => void
  onDismiss: () => void
}

export function MissingPermissionsModal({ open, onResolved, onDismiss }: MissingPermissionsModalProps) {
  const [requesting, setRequesting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showSettingsGuide, setShowSettingsGuide] = useState(false)

  useEffect(() => {
    if (!open) {
      setErrorMessage('')
      setShowSettingsGuide(false)
    }
  }, [open])

  if (!open) return null

  async function retryGpsPermission() {
    setRequesting(true)
    setErrorMessage('')

    try {
      const result = await requestPreciseGeolocation()
      const snapshot = await getPermissionSnapshot()

      if (result.granted || isGpsPermissionGranted(snapshot)) {
        setPermissionAck(true)
        syncPermissionAckFromSnapshot(snapshot)
        onResolved()
        return
      }

      const permission = await queryGeolocationPermission()
      if (permission === 'denied') {
        setShowSettingsGuide(true)
      }
      setErrorMessage(geolocationFailureMessage(result.reason))
    } finally {
      setRequesting(false)
    }
  }

  if (showSettingsGuide) {
    return (
      <GpsPermissionModal
        open
        mode="recheck"
        showSettingsGuide
        requesting={requesting}
        errorMessage={errorMessage}
        onAllow={() => void retryGpsPermission()}
        onDismiss={onDismiss}
        showEmphasisNotice
        showBackgroundNotice
      />
    )
  }

  return (
    <div className="modal-overlay z-[70]">
      <div className="modal-card max-w-md" role="dialog" aria-labelledby="missing-permissions-title">
        <h2 id="missing-permissions-title" className="section-title">
          위치 권한이 필요해요
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          촬영 감지를 위해 GPS 위치 권한이 필요해요.
        </p>
        {errorMessage ? <p className="alert-danger mb-4 text-sm">{errorMessage}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn-secondary" onClick={onDismiss} disabled={requesting}>
            LATER
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void retryGpsPermission()}
            disabled={requesting}
          >
            {requesting ? '요청 중...' : '다시 요청'}
          </button>
        </div>
        <button
          type="button"
          className="btn-secondary mt-3 w-full"
          onClick={() => setShowSettingsGuide(true)}
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
        const needsGps = !isGpsPermissionGranted(snapshot) || findPermissionGaps(snapshot, stored)
        if (needsGps) {
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
        onResolved={() => setShowModal(false)}
        onDismiss={() => setShowModal(false)}
      />
    </>
  )
}
