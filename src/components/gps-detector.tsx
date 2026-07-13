'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { haversineDistanceMeters } from '@/lib/geo'
import {
  geolocationFailureMessage,
  GPS_DETECTION_FAILURE_MESSAGE,
  GPS_PERMISSION_REQUIRED_MESSAGE,
  PRECISE_GEOLOCATION_OPTIONS,
  queryGeolocationPermission,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { GpsPermissionEmphasisNotice } from '@/components/gps-permission-emphasis-notice'
import {
  createInitialGpsPassZoneState,
  GPS_EXIT_RADIUS_METERS,
  MAX_GPS_PASSES_PER_DAY,
  nextGpsPassZoneState,
  type GpsPassZoneState,
} from '@/lib/gps-pass'
import type { EventGpsLocation, GpsLocationNumber } from '@/lib/gps-locations'
import {
  isGpsTrackingEnabled,
  setGpsTrackingEnabled,
  useGpsTrackingEnabled,
} from '@/lib/gps-tracking-storage'
import { syncGpsTrackingPref } from '@/lib/gps-tracking-pref-client'
import { authFetch } from '@/lib/supabase/auth-client'

type GpsDetectorProps = {
  eventId: string
  eventName: string
  locations: EventGpsLocation[]
  isLoopCourse?: boolean
  userId: string | null
  purchaseVerified: boolean
  verificationChecked: boolean
  headless?: boolean
}

function formatCoord(value: number): string {
  return value.toFixed(6)
}

function createZoneStateMap(locations: EventGpsLocation[], maxPasses: number) {
  const map = new Map<GpsLocationNumber, GpsPassZoneState>()
  for (const location of locations) {
    map.set(location.locationNumber, createInitialGpsPassZoneState(0, { maxPasses }))
  }
  return map
}

/** 근접 구역(반경×3) 안에서 위치를 더 자주 확인하는 보조 폴링 주기 */
const NEAR_ZONE_POLL_INTERVAL_MS = 3000

export function GpsDetector({
  eventId,
  eventName,
  locations,
  isLoopCourse = false,
  userId,
  purchaseVerified,
  verificationChecked,
  headless = false,
}: GpsDetectorProps) {
  const watchIdRef = useRef<number | null>(null)
  const zoneStateRef = useRef<Map<GpsLocationNumber, GpsPassZoneState>>(
    createZoneStateMap(locations, isLoopCourse ? MAX_GPS_PASSES_PER_DAY : 1)
  )
  const recordingRef = useRef<Set<string>>(new Set())
  const autoStartedRef = useRef(false)
  const nearZoneIntervalRef = useRef<number | null>(null)
  const handlePositionRef = useRef<(position: GeolocationPosition) => void>(() => {})
  const [storedEnabled] = useGpsTrackingEnabled(eventId)
  const [tracking, setTracking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [permissionOpen, setPermissionOpen] = useState(false)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLng, setCurrentLng] = useState<number | null>(null)
  const [distanceByLocation, setDistanceByLocation] = useState<Record<number, number>>({})
  const [passCountToday, setPassCountToday] = useState(0)
  const maxPasses = isLoopCourse ? MAX_GPS_PASSES_PER_DAY : 1
  const activeLocations = useMemo(
    () => (locations.length > 0 ? locations : []),
    [locations]
  )

  const stopNearZonePolling = useCallback(() => {
    if (nearZoneIntervalRef.current !== null) {
      window.clearInterval(nearZoneIntervalRef.current)
      nearZoneIntervalRef.current = null
    }
  }, [])

  const startNearZonePolling = useCallback(() => {
    if (nearZoneIntervalRef.current !== null) return
    nearZoneIntervalRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => handlePositionRef.current(pos),
        () => {
          // 보조 폴링 실패는 조용히 무시 — watchPosition이 기본 추적을 계속 담당
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      )
    }, NEAR_ZONE_POLL_INTERVAL_MS)
  }, [])

  const clearWatchOnly = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    stopNearZonePolling()
  }, [stopNearZonePolling])

  const stopTracking = useCallback(() => {
    clearWatchOnly()
    setTracking(false)
    setCurrentLat(null)
    setCurrentLng(null)
    setDistanceByLocation({})
    setGpsTrackingEnabled(eventId, false)
    void syncGpsTrackingPref(eventId, false)
  }, [clearWatchOnly, eventId])

  useEffect(() => {
    zoneStateRef.current = createZoneStateMap(activeLocations, maxPasses)
  }, [activeLocations, maxPasses])

  // 페이지 이탈 시 watch만 정리. 토글 OFF로 저장하면 재진입 시 자동 추적이 풀림.
  useEffect(() => {
    return () => clearWatchOnly()
  }, [clearWatchOnly])

  useEffect(() => {
    if (!purchaseVerified && tracking) {
      stopTracking()
    }
  }, [purchaseVerified, tracking, stopTracking])

  const canUseGps = verificationChecked && !!userId && purchaseVerified && activeLocations.length > 0

  const syncTodayPasses = useCallback(async () => {
    try {
      const res = await authFetch(`/api/gps-log?event_id=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (!res.ok) return

      const nextState = createZoneStateMap(activeLocations, maxPasses)
      for (const group of data.locations ?? []) {
        const locationNumber = Number(group.location_number) === 2 ? 2 : 1
        const count = group.pass_count ?? group.passes?.length ?? 0
        nextState.set(locationNumber, createInitialGpsPassZoneState(count, { maxPasses }))
      }
      zoneStateRef.current = nextState
      setPassCountToday(data.pass_count ?? 0)
    } catch {
      // ignore
    }
  }, [activeLocations, eventId, maxPasses])

  const recordPass = useCallback(
    async (
      latitude: number,
      longitude: number,
      locationNumber: GpsLocationNumber,
      passCount: number
    ) => {
      const key = `${locationNumber}-${passCount}`
      if (recordingRef.current.has(key)) return

      recordingRef.current.add(key)
      try {
        const res = await authFetch('/api/gps-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            lat: latitude,
            lng: longitude,
            location_number: locationNumber,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          const state = zoneStateRef.current.get(locationNumber)
          if (state) {
            zoneStateRef.current.set(locationNumber, {
              ...state,
              passCountToday: Math.max(0, state.passCountToday - 1),
              armedForNextPass: true,
            })
          }
          setPassCountToday(prev => Math.max(0, prev - 1))
          setErrorMsg(data.error ?? '통과 기록 저장 실패')
          return
        }

        setPassCountToday(prev => prev + 1)
      } catch {
        const state = zoneStateRef.current.get(locationNumber)
        if (state) {
          zoneStateRef.current.set(locationNumber, {
            ...state,
            passCountToday: Math.max(0, state.passCountToday - 1),
            armedForNextPass: true,
          })
        }
        setPassCountToday(prev => Math.max(0, prev - 1))
        setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
      } finally {
        recordingRef.current.delete(key)
      }
    },
    [eventId]
  )

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords
      const nextDistances: Record<number, number> = {}
      let isNearAnyZone = false

      setCurrentLat(latitude)
      setCurrentLng(longitude)

      for (const location of activeLocations) {
        const distance = haversineDistanceMeters(latitude, longitude, location.lat, location.lng)
        nextDistances[location.locationNumber] = Math.round(distance)
        const precisionZoneRadiusMeters = location.radiusMeters * 3
        const exitRadius = Math.max(GPS_EXIT_RADIUS_METERS, location.radiusMeters * 2)

        if (distance <= precisionZoneRadiusMeters) {
          isNearAnyZone = true
        }

        const currentState =
          zoneStateRef.current.get(location.locationNumber) ??
          createInitialGpsPassZoneState(0, { maxPasses })
        const { state, shouldRecord } = nextGpsPassZoneState(currentState, distance, {
          enterRadius: location.radiusMeters,
          exitRadius,
          maxPasses,
        })
        zoneStateRef.current.set(location.locationNumber, state)

        if (shouldRecord) {
          void recordPass(latitude, longitude, location.locationNumber, state.passCountToday)
        }
      }

      setDistanceByLocation(nextDistances)

      // 근접 구역 안에서는 위치를 더 자주 확인해 통과 판정 정밀도를 높이고,
      // 벗어나면 배터리 절약을 위해 보조 폴링을 멈춤 (watchPosition은 계속 유지)
      if (isNearAnyZone) {
        startNearZonePolling()
      } else {
        stopNearZonePolling()
      }
    },
    [activeLocations, maxPasses, recordPass, startNearZonePolling, stopNearZonePolling]
  )

  useEffect(() => {
    handlePositionRef.current = handlePosition
  }, [handlePosition])

  const startTracking = useCallback(() => {
    if (!canUseGps) return

    if (!navigator.geolocation) {
      setErrorMsg('이 브라우저는 위치 서비스를 지원하지 않아요')
      return
    }

    setErrorMsg('')
    void syncTodayPasses()

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      err => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? GPS_PERMISSION_REQUIRED_MESSAGE
            : GPS_DETECTION_FAILURE_MESSAGE
        )
        stopTracking()
      },
      PRECISE_GEOLOCATION_OPTIONS
    )

    setTracking(true)
    setGpsTrackingEnabled(eventId, true)
    void syncGpsTrackingPref(eventId, true)
  }, [canUseGps, eventId, handlePosition, stopTracking, syncTodayPasses])

  const beginTrackingWithPermission = useCallback(async () => {
    if (!canUseGps) return

    setPermissionError('')
    setRequestingPermission(true)
    const result = await requestPreciseGeolocation()
    setRequestingPermission(false)

    if (!result.granted) {
      const message = geolocationFailureMessage(result.reason)
      setPermissionError(message)
      setErrorMsg(message)
      return
    }

    setPermissionOpen(false)
    setPermissionError('')
    startTracking()
  }, [canUseGps, startTracking])

  useEffect(() => {
    if (!canUseGps || autoStartedRef.current || !isGpsTrackingEnabled(eventId)) return
    autoStartedRef.current = true

    void (async () => {
      const permission = await queryGeolocationPermission()
      if (permission === 'granted') {
        startTracking()
        return
      }

      if (permission === 'denied') {
        const message = geolocationFailureMessage('denied')
        setErrorMsg(message)
        setPermissionError(message)
      }

      setPermissionOpen(true)
    })()
  }, [canUseGps, eventId, startTracking])

  function handleToggle() {
    if (!canUseGps) return
    if (tracking || storedEnabled) {
      stopTracking()
      return
    }
    setPermissionError('')
    setPermissionOpen(true)
  }

  if (headless) {
    return null
  }

  return (
    <>
      <div className="card-section" data-event-name={eventName}>
        <div className="toggle-row mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">📍 촬영 감지</p>
            <p className="mt-1 text-xs text-muted">
              촬영 위치 {activeLocations.length}곳 · 위치별 {maxPasses}회까지 기록
              {isLoopCourse ? ` (순환 코스 최대 ${MAX_GPS_PASSES_PER_DAY}회)` : ' (대회당 1회)'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tracking || storedEnabled}
            aria-disabled={!canUseGps}
            aria-label="촬영 감지 ON/OFF"
            disabled={!canUseGps}
            onClick={handleToggle}
            className={`toggle-switch ${tracking || storedEnabled ? 'toggle-switch-on' : ''}`}
          >
            <span className="toggle-switch-thumb" />
          </button>
        </div>

        <div className="gps-athlete-checklist">
          <p className="gps-athlete-checklist-title">✓ 경기 시작 전 확인사항:</p>
          <ul className="gps-athlete-checklist-list">
            <li>- 핸드폰 GPS 설정에서 ON</li>
            <li>- OKbroGATE 앱 GPS 권한 허용</li>
            <li>- 경기 종료까지 앱 실행 유지</li>
          </ul>
        </div>

        {verificationChecked && !purchaseVerified && (
          <p className="text-xs text-muted">과일 구매 인증 후 사용 가능합니다</p>
        )}

        {!userId && verificationChecked && (
          <p className="text-xs text-muted">로그인 후 이용할 수 있어요</p>
        )}

        {activeLocations.length === 0 && (
          <p className="text-xs text-muted">촬영 위치가 설정되지 않았어요</p>
        )}

        {passCountToday > 0 && (
          <p className="mb-2 text-xs font-medium text-success">오늘 총 {passCountToday}회 기록됨</p>
        )}

        {tracking && currentLat != null && currentLng != null && (
          <div className="space-y-2 text-xs leading-relaxed">
            <p className="font-medium text-danger">
              🔴 추적 중... (현재 좌표: {formatCoord(currentLat)}, {formatCoord(currentLng)})
            </p>
            {activeLocations.map(location => {
              const distance = distanceByLocation[location.locationNumber]
              const exitRadius = Math.max(GPS_EXIT_RADIUS_METERS, location.radiusMeters * 2)
              return (
                <p
                  key={location.locationNumber}
                  className={
                    distance != null && distance <= location.radiusMeters
                      ? 'text-success'
                      : distance != null && distance >= exitRadius
                        ? 'text-muted'
                        : 'text-warning'
                  }
                >
                  {activeLocations.length > 1 ? `${location.locationNumber}차 위치` : '촬영 위치'}:{' '}
                  {distance != null ? `${distance}m` : '-'} (도착 {location.radiusMeters}m)
                </p>
              )
            })}
          </div>
        )}

        {errorMsg && <p className="mt-3 text-xs text-danger">{errorMsg}</p>}
      </div>

      <GpsPermissionModal
        open={permissionOpen}
        requesting={requestingPermission}
        errorMessage={permissionError}
        onAllow={() => void beginTrackingWithPermission()}
        onDismiss={() => {
          setPermissionOpen(false)
          setPermissionError('')
        }}
        showBackgroundNotice
        footer={permissionOpen ? <GpsPermissionEmphasisNotice /> : null}
      />
    </>
  )
}
