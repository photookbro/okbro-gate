'use client'

import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'

type GpsTrackingToggleProps = {
  eventId: string
  disabled?: boolean
  compact?: boolean
  onToggle?: (enabled: boolean) => void
}

export function GpsTrackingToggle({
  eventId,
  disabled = false,
  compact = false,
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

  return (
    <div
      className={`flex items-center gap-2 ${compact ? '' : 'justify-between'}`}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      role="presentation"
    >
      <span className="text-xs text-muted">📍</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-disabled={disabled}
        aria-label="촬영 감지 ON/OFF"
        disabled={disabled}
        onClick={handleClick}
        className={`toggle-switch toggle-switch-sm ${enabled ? 'toggle-switch-on' : ''}`}
      >
        <span className="toggle-switch-thumb" />
      </button>
      <span className="text-xs font-medium text-[var(--text)]">{enabled ? 'ON' : 'OFF'}</span>
    </div>
  )
}
