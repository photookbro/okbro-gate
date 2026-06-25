import { createClient } from '@/lib/supabase/client'

async function buildAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: HeadersInit = {}
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

async function refreshClientSession(): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.refreshSession()
  return !error && !!data.session
}

export async function fetchGpsTrackingPref(eventId: string): Promise<boolean> {
  try {
    const headers = await buildAuthHeaders()
    const res = await fetch(
      `/api/gps-tracking-pref?event_id=${encodeURIComponent(eventId)}`,
      { credentials: 'same-origin', headers }
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(await buildAuthHeaders()),
    }

    let res = await fetch('/api/gps-tracking-pref', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ event_id: eventId, enabled }),
    })

    if (res.status === 401) {
      const refreshed = await refreshClientSession()
      if (refreshed) {
        res = await fetch('/api/gps-tracking-pref', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await buildAuthHeaders()),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ event_id: eventId, enabled }),
        })
      }
    }

    if (!res.ok) {
      return
    }

    await res.json().catch(() => {})
  } catch {
    // 네트워크/500 등 실패해도 로컬 UI는 유지
  }
}
