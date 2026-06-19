'use client'

import { useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { GpsPermissionEmphasisNotice } from '@/components/gps-permission-emphasis-notice'
import { requestPreciseGeolocation } from '@/lib/geolocation-request'
import { syncGpsTrackingPref } from '@/lib/gps-tracking-pref-client'
import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'

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

  async function enableTracking() {
    setRequesting(true)
    const granted = await requestPreciseGeolocation()
    setRequesting(false)

    if (!granted) return

    setEnabled(true)
    onToggle?.(true)
    setPermissionOpen(false)
    void syncGpsTrackingPref(eventId, true)
  }

  function disableTracking() {
    setEnabled(false)
    onToggle?.(false)
    void syncGpsTrackingPref(eventId, false)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return

    if (enabled) {
      disableTracking()
      return
    }

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
        onClick={e => e.stopPropagation()}
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
          aria-label={isEventsList ? (enabled ? 'GPS 감지 중' : 'GPS 감지 OFF') : '촬영 감지 ON/OFF'}
          disabled={disabled}
          onClick={handleClick}
          className={`toggle-switch toggle-switch-sm ${switchClass}`}
        >
          <span className="toggle-switch-thumb" />
        </button>
        {isEventsList ? (
          <span className={enabled ? 'events-gps-switch-label-on' : 'events-gps-switch-label-off'}>
            {enabled ? '감지중' : 'OFF'}
          </span>
        ) : (
          <span className="text-xs font-medium text-[var(--text)]">{enabled ? 'ON' : 'OFF'}</span>
        )}
      </div>

      <GpsPermissionModal
        open={permissionOpen}
        requesting={requesting}
        onAllow={() => void enableTracking()}
        onDismiss={() => setPermissionOpen(false)}
        footer={permissionOpen ? <GpsPermissionEmphasisNotice /> : null}
      />
    </>
  )
}
