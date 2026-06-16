'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'okbro-gps-tracking'
const CHANGE_EVENT = 'okbro-gps-tracking-change'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
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

export function useGpsTrackingEnabled(eventId: string): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(isGpsTrackingEnabled(eventId))

    function sync() {
      setEnabled(isGpsTrackingEnabled(eventId))
    }

    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
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
