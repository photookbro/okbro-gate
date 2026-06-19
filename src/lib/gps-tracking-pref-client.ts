export async function syncGpsTrackingPref(eventId: string, enabled: boolean): Promise<void> {
  try {
    const res = await fetch('/api/gps-tracking-pref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
