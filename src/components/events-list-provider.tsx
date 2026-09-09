'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  parseEventsListResponse,
  type EventsListPastEvent,
  type EventsListUpcomingEvent,
} from '@/lib/events-list-client'

type EventsListContextValue = {
  past: EventsListPastEvent[]
  upcoming: EventsListUpcomingEvent[]
  loading: boolean
  error: string
  /** GPS 통과 시각 등 quiet 갱신 — 스피너 없이 전체 목록 다시 받음 */
  quietReload: () => void
}

const EventsListContext = createContext<EventsListContextValue | null>(null)

export function EventsListProvider({ children }: { children: ReactNode }) {
  const [past, setPast] = useState<EventsListPastEvent[]>([])
  const [upcoming, setUpcoming] = useState<EventsListUpcomingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const applyPayload = useCallback((data: unknown, showError: boolean) => {
    const parsed = parseEventsListResponse(data)
    setPast(parsed.past)
    setUpcoming(parsed.upcoming)
    if (showError) setError('')
  }, [])

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setLoading(true)
        setError('')
      }

      try {
        const res = await authFetch('/api/events/list')
        const data = await res.json()
        if (!res.ok) {
          if (showSpinner) {
            setError(typeof data.error === 'string' ? data.error : '목록을 불러오지 못했어요')
          }
          return
        }
        applyPayload(data, showSpinner)
      } catch {
        if (showSpinner) setError('목록을 불러오지 못했어요')
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [applyPayload]
  )

  useEffect(() => {
    void load(true)
  }, [load])

  const quietReload = useCallback(() => {
    void load(false)
  }, [load])

  const value = useMemo(
    () => ({ past, upcoming, loading, error, quietReload }),
    [past, upcoming, loading, error, quietReload]
  )

  return <EventsListContext.Provider value={value}>{children}</EventsListContext.Provider>
}

export function useEventsList(): EventsListContextValue {
  const ctx = useContext(EventsListContext)
  if (!ctx) {
    throw new Error('useEventsList must be used within EventsListProvider')
  }
  return ctx
}
