import { authFetch } from '@/lib/supabase/auth-client'

/** true/false = 서버 확정값, null = 조회 실패(로컬 유지) */
export async function fetchGpsTrackingPref(eventId: string): Promise<boolean | null> {
  try {
    const res = await authFetch(
      `/api/gps-tracking-pref?event_id=${encodeURIComponent(eventId)}`
    )

    if (res.status === 401) return null
    if (!res.ok) return null

    const data = (await res.json()) as { enabled?: boolean }
    return data.enabled === true
  } catch {
    return null
  }
}

export async function syncGpsTrackingPref(eventId: string, enabled: boolean): Promise<boolean> {
  try {
    const res = await authFetch('/api/gps-tracking-pref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, enabled }),
    })

    if (!res.ok) return false

    await res.json().catch(() => {})
    return true
  } catch {
    return false
  }
}
