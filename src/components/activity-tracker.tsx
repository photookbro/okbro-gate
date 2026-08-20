'use client'

import { useEffect, useRef } from 'react'
import { authFetch } from '@/lib/supabase/auth-client'

/** Fire-and-forget: updates profiles.last_active_at once per mount when logged in. */
export function ActivityTracker() {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    void authFetch('/api/track-activity', { method: 'POST' }).catch(() => {
      // Intentionally ignored — must not affect app UX
    })
  }, [])

  return null
}
