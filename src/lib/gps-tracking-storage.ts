'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchGpsTrackingPref } from '@/lib/gps-tracking-pref-client'

const STORAGE_KEY = 'okbro-gps-tracking'
const CHANGE_EVENT = 'okbro-gps-tracking-change'
/** 로그아웃 직후 GpsDetector 등이 watchPosition을 즉시 끊도록 알림 */
export const AUTH_LOGOUT_EVENT = 'okbro-auth-logout'

type GpsTrackingMap = Record<string, boolean>

function readMap(): GpsTrackingMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as GpsTrackingMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: GpsTrackingMap) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // ignore quota / private mode errors
  }
}

export function isGpsTrackingEnabled(eventId: string): boolean {
  return readMap()[eventId] === true
}

export function setGpsTrackingEnabled(eventId: string, enabled: boolean) {
  const map = readMap()
  if (enabled) {
    map[eventId] = true
  } else {
    delete map[eventId]
  }
  writeMap(map)
}

/** 로그아웃 시 로컬 CAPTURING 표시/자동시작 플래그를 전부 제거 */
export function clearAllGpsTrackingLocal() {
  writeMap({})
}

export function emitAuthLogout() {
  clearAllGpsTrackingLocal()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT))
  }
}

export function useGpsTrackingEnabled(eventId: string): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(() => isGpsTrackingEnabled(eventId))

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const serverEnabled = await fetchGpsTrackingPref(eventId)
      if (cancelled) return

      // 조회 실패(null)면 로컬 유지 — 실패를 OFF로 덮어쓰지 않음
      if (serverEnabled === null) {
        setEnabled(isGpsTrackingEnabled(eventId))
        return
      }

      setGpsTrackingEnabled(eventId, serverEnabled)
      setEnabled(serverEnabled)
    }

    void hydrate()

    function sync() {
      setEnabled(isGpsTrackingEnabled(eventId))
    }

    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      cancelled = true
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [eventId])

  const set = useCallback(
    (next: boolean) => {
      setGpsTrackingEnabled(eventId, next)
      setEnabled(next)
    },
    [eventId]
  )

  return [enabled, set]
}
