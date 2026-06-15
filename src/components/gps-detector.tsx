'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPassTimeSeconds, haversineDistanceMeters } from '@/lib/geo'

type GpsDetectorProps = {
  eventId: string
  eventName: string
  gpsLat: number
  gpsLng: number
  gpsRadiusMeters: number
  userId: string | null
  purchaseVerified: boolean
  verificationChecked: boolean
}

function formatCoord(value: number): string {
  return value.toFixed(4)
}

export function GpsDetector({
  eventId,
  eventName,
  gpsLat,
  gpsLng,
  gpsRadiusMeters,
  userId,
  purchaseVerified,
  verificationChecked,
}: GpsDetectorProps) {
  const watchIdRef = useRef<number | null>(null)
  const loggedTodayRef = useRef(false)
  const [tracking, setTracking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLng, setCurrentLng] = useState<number | null>(null)
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTracking(false)
    setCurrentLat(null)
    setCurrentLng(null)
    setDistanceMeters(null)
  }, [])

  useEffect(() => {
    return () => stopTracking()
  }, [stopTracking])

  useEffect(() => {
    if (!purchaseVerified && tracking) {
      stopTracking()
    }
  }, [purchaseVerified, tracking, stopTracking])

  const canUseGps = verificationChecked && !!userId && purchaseVerified

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const recordPass = useCallback(
    async (latitude: number, longitude: number) => {
      if (loggedTodayRef.current) return

      try {
        const res = await fetch('/api/gps-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, lat: latitude, lng: longitude }),
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error ?? '통과 기록 저장 실패')
          return
        }

        loggedTodayRef.current = true
        const passedAt = data.passed_at ? new Date(data.passed_at) : new Date()
        const timeLabel = formatPassTimeSeconds(passedAt)
        setToast(`✅ ${eventName} 촬영자 통과! ${timeLabel}`)
      } catch {
        setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
      }
    },
    [eventId, eventName]
  )

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords
      const distance = haversineDistanceMeters(latitude, longitude, gpsLat, gpsLng)

      setCurrentLat(latitude)
      setCurrentLng(longitude)
      setDistanceMeters(Math.round(distance))

      if (distance <= gpsRadiusMeters) {
        void recordPass(latitude, longitude)
      }
    },
    [gpsLat, gpsLng, gpsRadiusMeters, recordPass]
  )

  const startTracking = useCallback(() => {
    if (!canUseGps) return

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
  }, [canUseGps, handlePosition, stopTracking])

  function handleToggle() {
    if (!canUseGps) return
    if (tracking) {
      stopTracking()
      return
    }
    startTracking()
  }

  return (
    <>
      <div className="card-section">
        <div className="toggle-row mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">📍 촬영 감지</p>
            <p className="mt-1 text-xs text-muted">
              촬영 지점 반경 {gpsRadiusMeters}m 이내 진입 시 통과 시각을 기록해요.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tracking}
            aria-disabled={!canUseGps}
            aria-label="촬영 감지 ON/OFF"
            disabled={!canUseGps}
            onClick={handleToggle}
            className={`toggle-switch ${tracking ? 'toggle-switch-on' : ''}`}
          >
            <span className="toggle-switch-thumb" />
          </button>
        </div>

        {verificationChecked && !purchaseVerified && (
          <p className="text-xs text-muted">과일 구매 인증 후 사용 가능합니다</p>
        )}

        {!userId && verificationChecked && (
          <p className="text-xs text-muted">로그인 후 이용할 수 있어요</p>
        )}

        {tracking && currentLat != null && currentLng != null && (
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-medium text-danger">
              🔴 추적 중... (현재 좌표: {formatCoord(currentLat)}, {formatCoord(currentLng)})
            </p>
            {distanceMeters != null && (
              <p className={distanceMeters <= gpsRadiusMeters ? 'text-success' : 'text-muted'}>
                거리: {distanceMeters}m (반경: {gpsRadiusMeters}m)
              </p>
            )}
          </div>
        )}

        {errorMsg && <p className="mt-3 text-xs text-danger">{errorMsg}</p>}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] w-[360px] max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-3.5 text-sm leading-relaxed text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
