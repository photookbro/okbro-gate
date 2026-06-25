export async function fetchGpsTrackingPref(eventId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/gps-tracking-pref?event_id=${encodeURIComponent(eventId)}`,
      { credentials: 'same-origin' }
    )

    if (res.status === 401) return false
    if (!res.ok) return false

    const data = (await res.json()) as { enabled?: boolean }
    return data.enabled === true
  } catch {
    return false
  }
}

export async function syncGpsTrackingPref(eventId: string, enabled: boolean): Promise<void> {
  try {
    const res = await fetch('/api/gps-tracking-pref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ event_id: eventId, enabled }),
    })

    if (!res.ok) {
      return
    }

    await res.json().catch(() => {})
  } catch {
    // 네트워크/500 등 실패해도 로컬 UI는 유지
  }
}
