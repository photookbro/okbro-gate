'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Event } from '@/types'

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = Pick<
  Event,
  'id' | 'name' | 'gps_lat' | 'gps_lng' | 'gps_radius_meters' | 'gps_enabled'
>

export default function GpsDetector({ event }: { event: Props }) {
  const [tracking, setTracking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const loggedTodayRef = useRef(false)
  const supabase = createClient()

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
  }, [])

  useEffect(() => {
    return () => stopTracking()
  }, [stopTracking])

  async function logPass() {
    if (loggedTodayRef.current) return

    const res = await fetch('/api/gps-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: event.id }),
    })

    if (res.status === 401) {
      setError('로그인이 필요합니다.')
      stopTracking()
      return
    }

    if (!res.ok) return

    loggedTodayRef.current = true
    const now = new Date()
    setToast(`✅ ${event.name} 현장 통과를 감지했어요! ${formatTime(now)}`)
    setTimeout(() => setToast(null), 5000)
  }

  async function startTracking() {
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('GPS 알림을 받으려면 로그인해 주세요.')
      return
    }

    if (event.gps_lat == null || event.gps_lng == null) {
      setError('이 대회의 GPS 좌표가 설정되지 않았습니다.')
      return
    }

    if (!navigator.geolocation) {
      setError('이 브라우저는 위치 서비스를 지원하지 않습니다.')
      return
    }

    const radius = event.gps_radius_meters ?? 200

    watchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        const distance = haversineDistance(
          position.coords.latitude,
          position.coords.longitude,
          event.gps_lat!,
          event.gps_lng!
        )

        if (distance <= radius) {
          logPass()
        }
      },
      err => {
        setError(`위치 권한 오류: ${err.message}`)
        stopTracking()
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    setTracking(true)
  }

  if (!event.gps_enabled) return null

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', position: 'relative' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        📍 현장 통과 알림
      </h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        대회 현장 근처({event.gps_radius_meters ?? 200}m)에 들어오면 알림을 보내드려요.
      </p>

      {!tracking ? (
        <button type="button" className="btn-primary" onClick={startTracking}>
          📍 대회 현장 통과 알림 받기
        </button>
      ) : (
        <button
          type="button"
          onClick={stopTracking}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          추적 중지
        </button>
      )}

      {tracking && (
        <p style={{ fontSize: '0.75rem', color: 'var(--green)', marginTop: '0.5rem' }}>
          위치 추적 중...
        </p>
      )}

      {error && (
        <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.5rem' }}>{error}</p>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--green)',
            color: 'var(--text)',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
