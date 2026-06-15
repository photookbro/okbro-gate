'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPassTime, haversineDistanceMeters } from '@/lib/geo'

type GpsDetectorProps = {
  eventId: string
  eventName: string
  gpsLat: number
  gpsLng: number
  gpsRadiusMeters: number
  userId: string | null
}

export function GpsDetector({
  eventId,
  eventName,
  gpsLat,
  gpsLng,
  gpsRadiusMeters,
  userId,
}: GpsDetectorProps) {
  const watchIdRef = useRef<number | null>(null)
  const loggedTodayRef = useRef(false)
  const [tracking, setTracking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
  }, [])

  useEffect(() => {
    return () => stopTracking()
  }, [stopTracking])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  async function recordPass() {
    if (loggedTodayRef.current) return

    try {
      const res = await fetch('/api/gps-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? '통과 기록 저장 실패')
        return
      }

      loggedTodayRef.current = true
      const passedAt = data.passed_at ? new Date(data.passed_at) : new Date()
      const timeLabel = formatPassTime(passedAt)
      setToast(`✅ ${eventName} 현장 통과를 감지했어요! ${timeLabel}`)
    } catch {
      setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
    }
  }

  function handlePosition(position: GeolocationPosition) {
    const { latitude, longitude } = position.coords
    const distance = haversineDistanceMeters(latitude, longitude, gpsLat, gpsLng)

    if (distance <= gpsRadiusMeters) {
      void recordPass()
    }
  }

  function startTracking() {
    if (!userId) {
      setErrorMsg('로그인 후 이용할 수 있어요')
      return
    }

    if (!navigator.geolocation) {
      setErrorMsg('이 브라우저는 위치 서비스를 지원하지 않아요')
      return
    }

    setErrorMsg('')

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      err => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? '위치 권한이 거부됐어요. 설정에서 허용해주세요.'
            : '위치를 가져오지 못했어요'
        )
        stopTracking()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    )

    setTracking(true)
  }

  return (
    <>
      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
          📍 대회 현장 통과 알림
        </p>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>
          현장 근처에 도착하면 자동으로 통과 시각을 기록해요. (반경 {gpsRadiusMeters}m)
        </p>

        {!tracking ? (
          <button
            type="button"
            onClick={startTracking}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            📍 대회 현장 통과 알림 받기
          </button>
        ) : (
          <button
            type="button"
            onClick={stopTracking}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⏹ 추적 중지
          </button>
        )}

        {tracking && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#16a34a' }}>
            위치 추적 중...
          </p>
        )}

        {errorMsg && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: '#ef4444' }}>{errorMsg}</p>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: '90vw',
            width: '360px',
            padding: '0.875rem 1rem',
            borderRadius: '10px',
            backgroundColor: '#111827',
            color: '#ffffff',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
