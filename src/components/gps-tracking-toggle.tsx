'use client'

import { useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { GpsPermissionEmphasisNotice } from '@/components/gps-permission-emphasis-notice'
import {
  geolocationFailureMessage,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'
import { syncGpsTrackingPref } from '@/lib/gps-tracking-pref-client'
import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'
import { ensurePushSubscription } from '@/lib/push-client'

type GpsTrackingToggleProps = {
  eventId: string
  disabled?: boolean
  compact?: boolean
  variant?: 'default' | 'events-list'
  onToggle?: (enabled: boolean) => void
}

export function GpsTrackingToggle({
  eventId,
  disabled = false,
  compact = false,
  variant = 'default',
  onToggle,
}: GpsTrackingToggleProps) {
  const [enabled, setEnabled] = useGpsTrackingEnabled(eventId)
  const [permissionOpen, setPermissionOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [permissionError, setPermissionError] = useState('')

  async function enableTracking() {
    setPermissionError('')
    setRequesting(true)
    const result = await requestPreciseGeolocation()
    setRequesting(false)

    if (!result.granted) {
      setPermissionError(geolocationFailureMessage(result.reason))
      return
    }

    setEnabled(true)
    onToggle?.(true)
    setPermissionOpen(false)

    const saved = await syncGpsTrackingPref(eventId, true)
    if (!saved) {
      setEnabled(false)
      onToggle?.(false)
      setPermissionError('설정 저장에 실패했어요. 로그인 상태를 확인한 뒤 다시 시도해주세요.')
      setPermissionOpen(true)
      return
    }

    void ensurePushSubscription()
  }

  async function disableTracking() {
    setEnabled(false)
    onToggle?.(false)
    const saved = await syncGpsTrackingPref(eventId, false)
    if (!saved) {
      setEnabled(true)
      onToggle?.(true)
    }
  }

  function stopNavigation(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleClick(e: React.MouseEvent) {
    stopNavigation(e)

    // OFF는 자격과 무관하게 허용. ON만 자격(disabled=false) 필요.
    if (enabled) {
      void disableTracking()
      return
    }

    if (disabled) return

    setPermissionError('')
    setPermissionOpen(true)
  }

  const isEventsList = variant === 'events-list'
  const switchClass = enabled
    ? isEventsList
      ? 'toggle-switch-events-on'
      : 'toggle-switch-on'
    : isEventsList
      ? 'toggle-switch-events-off'
      : ''

  return (
    <>
      <div
        className={`flex items-center gap-1.5 ${compact || isEventsList ? '' : 'justify-between'} ${isEventsList ? 'events-gps-switch-row' : ''}`}
        onClick={stopNavigation}
        onPointerDown={stopNavigation}
        onKeyDown={e => e.stopPropagation()}
        role="presentation"
      >
        {!isEventsList ? (
          <span className="text-xs text-muted" aria-hidden="true">
            📍
          </span>
        ) : null}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-disabled={disabled}
          aria-label={isEventsList ? (enabled ? 'GPS 포착 중' : 'GPS 포착 OFF') : '촬영 감지 ON/OFF'}
          disabled={disabled}
          onClick={handleClick}
          onPointerDown={stopNavigation}
          className={`toggle-switch toggle-switch-sm ${switchClass}`}
        >
          <span className="toggle-switch-thumb" />
        </button>
        {isEventsList ? (
          <span className={enabled ? 'events-gps-switch-label-on' : 'events-gps-switch-label-off'}>
            {enabled ? 'CAPTURING' : 'OFF'}
          </span>
        ) : (
          <span className="text-xs font-medium text-[var(--text)]">{enabled ? 'ON' : 'OFF'}</span>
        )}
      </div>

      <GpsPermissionModal
        open={permissionOpen}
        requesting={requesting}
        errorMessage={permissionError}
        onAllow={() => void enableTracking()}
        onDismiss={() => {
          setPermissionOpen(false)
          setPermissionError('')
        }}
        footer={permissionOpen ? <GpsPermissionEmphasisNotice /> : null}
      />
    </>
  )
}
