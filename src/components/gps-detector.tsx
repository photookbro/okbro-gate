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
  AUTH_LOGOUT_EVENT,
  isGpsTrackingEnabled,
  setGpsTrackingEnabled,
  useGpsTrackingEnabled,
} from '@/lib/gps-tracking-storage'
import { syncGpsTrackingPref } from '@/lib/gps-tracking-pref-client'
import { authFetch } from '@/lib/supabase/auth-client'
import { ensurePushSubscription } from '@/lib/push-client'
import { formatGpsPassDisplay } from '@/lib/gps-access'

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

type GpsPassLogGroup = {
  location_number: number
  passes: { pass_count: number; display_time: string }[]
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
  const canUseGpsRef = useRef(false)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  const [storedEnabled] = useGpsTrackingEnabled(eventId)
  const [tracking, setTracking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [permissionOpen, setPermissionOpen] = useState(false)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLng, setCurrentLng] = useState<number | null>(null)
  const [distanceByLocation, setDistanceByLocation] = useState<Record<number, number>>({})
  const [passLog, setPassLog] = useState<GpsPassLogGroup[]>([])
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

  const stopTracking = useCallback(
    (options?: { syncServer?: boolean }) => {
      clearWatchOnly()
      setTracking(false)
      setCurrentLat(null)
      setCurrentLng(null)
      setDistanceByLocation({})
      setGpsTrackingEnabled(eventId, false)
      autoStartedRef.current = false
      if (options?.syncServer !== false) {
        void syncGpsTrackingPref(eventId, false)
      }
    },
    [clearWatchOnly, eventId]
  )

  useEffect(() => {
    zoneStateRef.current = createZoneStateMap(activeLocations, maxPasses)
  }, [activeLocations, maxPasses])

  // 페이지 이탈 시 watch만 정리. 토글 OFF로 저장하면 재진입 시 자동 추적이 풀림.
  useEffect(() => {
    return () => clearWatchOnly()
  }, [clearWatchOnly])

  const canUseGps =
    verificationChecked && !!userId && purchaseVerified && activeLocations.length > 0

  useEffect(() => {
    canUseGpsRef.current = canUseGps
  }, [canUseGps])

  // 로그아웃·인증 만료 등으로 사용 불가해지면 watchPosition을 즉시 중단
  useEffect(() => {
    const prevUserId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (canUseGps) return

    clearWatchOnly()
    setTracking(false)
    setCurrentLat(null)
    setCurrentLng(null)
    setDistanceByLocation({})
    autoStartedRef.current = false

    // 세션 로딩 중(userId 초기 null)에는 로컬 플래그를 건드리지 않음
    if (prevUserId && !userId) {
      setGpsTrackingEnabled(eventId, false)
      return
    }

    if (userId && verificationChecked && !purchaseVerified) {
      setGpsTrackingEnabled(eventId, false)
      void syncGpsTrackingPref(eventId, false)
    }
  }, [
    canUseGps,
    userId,
    purchaseVerified,
    verificationChecked,
    clearWatchOnly,
    eventId,
  ])

  // 다른 탭/네비에서 로그아웃해도 즉시 중단
  useEffect(() => {
    function onAuthLogout() {
      stopTracking({ syncServer: false })
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, onAuthLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onAuthLogout)
  }, [stopTracking])

  const syncTodayPasses = useCallback(async () => {
    try {
      const res = await authFetch(`/api/gps-log?event_id=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (!res.ok) return

      const nextState = createZoneStateMap(activeLocations, maxPasses)
      const nextPassLog: GpsPassLogGroup[] = []
      for (const group of data.locations ?? []) {
        const locationNumber = Number(group.location_number) === 2 ? 2 : 1
        const count = group.pass_count ?? group.passes?.length ?? 0
        nextState.set(locationNumber, createInitialGpsPassZoneState(count, { maxPasses }))

        const passes = (group.passes ?? [])
          .filter((row: { passed_at?: string }) => row.passed_at)
          .map((row: { pass_count?: number; passed_at: string }) => ({
            pass_count: row.pass_count ?? 1,
            display_time: formatGpsPassDisplay(row.passed_at),
          }))
          .sort((a: { pass_count: number }, b: { pass_count: number }) => a.pass_count - b.pass_count)

        if (passes.length > 0) {
          nextPassLog.push({ location_number: locationNumber, passes })
        }
      }
      nextPassLog.sort((a, b) => a.location_number - b.location_number)

      zoneStateRef.current = nextState
      setPassLog(nextPassLog)
    } catch {
      // ignore
    }
  }, [activeLocations, eventId, maxPasses])

  // 토글이 꺼져있어도 참고용으로 오늘 통과 기록은 항상 불러와 보여줌
  useEffect(() => {
    if (!canUseGps) return
    void syncTodayPasses()
  }, [canUseGps, syncTodayPasses])

  const recordPass = useCallback(
    async (
      latitude: number,
      longitude: number,
      locationNumber: GpsLocationNumber,
      passCount: number
    ) => {
      if (!canUseGpsRef.current) return

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
          setErrorMsg(data.error ?? '통과 기록 저장 실패')
          return
        }

        void syncTodayPasses()
      } catch {
        const state = zoneStateRef.current.get(locationNumber)
        if (state) {
          zoneStateRef.current.set(locationNumber, {
            ...state,
            passCountToday: Math.max(0, state.passCountToday - 1),
            armedForNextPass: true,
          })
        }
        setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
      } finally {
        recordingRef.current.delete(key)
      }
    },
    [eventId, syncTodayPasses]
  )

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      if (!canUseGpsRef.current) {
        clearWatchOnly()
        return
      }

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
    [
      activeLocations,
      clearWatchOnly,
      maxPasses,
      recordPass,
      startNearZonePolling,
      stopNearZonePolling,
    ]
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
    void ensurePushSubscription()
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

  if (headless) {
    return null
  }

  // 비로그인 시 로컬 플래그만으로 CAPTURING이 남지 않게 함
  const isTrackingOn = !!userId && (tracking || storedEnabled)

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
          <span
            className={`text-xs font-semibold ${isTrackingOn ? 'text-success' : 'text-muted'}`}
          >
            {isTrackingOn ? '🟢 CAPTURING' : '⚪ 꺼짐'}
          </span>
        </div>

        {tracking ? (
          <div className="gps-distance-panel" aria-live="polite">
            {currentLat != null && currentLng != null ? (
              activeLocations.map(location => {
                const distance = distanceByLocation[location.locationNumber]
                const arrived =
                  distance != null && distance <= location.radiusMeters
                const multi = activeLocations.length > 1
                const place = multi ? `${location.locationNumber}차 촬영 위치` : '촬영 위치'
                const passGroup = passLog.find(
                  group => group.location_number === location.locationNumber
                )
                const latestPassTime =
                  passGroup && passGroup.passes.length > 0
                    ? passGroup.passes[passGroup.passes.length - 1].display_time
                    : null

                if (distance == null) {
                  return (
                    <div key={location.locationNumber} className="gps-distance-block">
                      <p className="gps-distance-line">
                        <span className="gps-distance-primary">{place}까지 —</span>
                      </p>
                    </div>
                  )
                }

                if (arrived) {
                  const arrivedLabel = multi
                    ? `${location.locationNumber}차 도착 ${distance}m`
                    : `도착 ${distance}m`

                  return (
                    <div key={location.locationNumber} className="gps-distance-block">
                      <p className="gps-distance-line">
                        <span className="gps-distance-primary">{arrivedLabel}</span>
                      </p>
                      {latestPassTime ? (
                        <p className="gps-pass-complete-time">
                          {latestPassTime} 촬영 완료
                        </p>
                      ) : null}
                    </div>
                  )
                }

                const distanceKm = (distance / 1000).toFixed(2)

                return (
                  <div key={location.locationNumber} className="gps-distance-block">
                    <p className="gps-distance-line">
                      <span className="gps-distance-primary">
                        {place}까지 {distance}m
                      </span>
                      <span className="gps-distance-secondary">
                        , 오켱까지 {distanceKm}km 떨어져 있어요
                      </span>
                    </p>
                  </div>
                )
              })
            ) : (
              <p className="gps-distance-line gps-distance-waiting">위치 확인 중입니다</p>
            )}
          </div>
        ) : null}

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
