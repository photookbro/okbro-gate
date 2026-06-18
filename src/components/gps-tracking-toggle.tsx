'use client'

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

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    const next = !enabled
    setEnabled(next)
    onToggle?.(next)
    void fetch('/api/gps-tracking-pref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, enabled: next }),
    }).catch(() => {})
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
  )
}
