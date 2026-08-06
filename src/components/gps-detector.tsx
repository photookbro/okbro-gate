'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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
  mergePassCountIntoZoneState,
  nextGpsPassZoneState,
  type GpsPassZoneState,
} from '@/lib/gps-pass'
import {
  parseLocationNumber,
  type EventGpsLocation,
  type GpsLocationNumber,
} from '@/lib/gps-locations'
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
  userId: string | null
  /**
   * GPS 토글/추적 허용 — 구매 인증 OR 인스타 혜택 유효.
   * 앨범 접근(status===valid, gps_logs 포함)과는 별개 게이트.
   */
  gpsTrackingEligible: boolean
  verificationChecked: boolean
  /** 어드민 gps_enabled — false면 실시간 추적만 막고, 통과 이력은 표시 */
  liveTrackingAllowed?: boolean
  headless?: boolean
}

type GpsPassLogGroup = {
  location_number: number
  passes: { pass_count: number; display_time: string }[]
}

function createZoneStateMap(locations: EventGpsLocation[]) {
  const map = new Map<GpsLocationNumber, GpsPassZoneState>()
  for (const location of locations) {
    map.set(location.locationNumber, createInitialGpsPassZoneState(0))
  }
  return map
}

/** 근접 구역(반경×3) 안에서 위치를 더 자주 확인하는 보조 폴링 주기 */
const NEAR_ZONE_POLL_INTERVAL_MS = 3000

/** POST 실패 후 같은 위치 재시도 쿨다운 (연속 실패 시 연장) */
const RECORD_FAIL_COOLDOWN_MS = 5_000
const RECORD_FAIL_COOLDOWN_ESCALATED_MS = 30_000
const RECORD_FAIL_ESCALATE_AFTER = 3

type RecordRetryState = {
  failCount: number
  cooldownUntil: number
  timerId: number | null
}

export function GpsDetector({
  eventId,
  eventName,
  locations,
  userId,
  gpsTrackingEligible,
  verificationChecked,
  liveTrackingAllowed = true,
  headless = false,
}: GpsDetectorProps) {
  const watchIdRef = useRef<number | null>(null)
  const zoneStateRef = useRef<Map<GpsLocationNumber, GpsPassZoneState>>(
    createZoneStateMap(locations)
  )
  const recordingRef = useRef<Set<string>>(new Set())
  const recordRetryRef = useRef<Map<GpsLocationNumber, RecordRetryState>>(new Map())
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
  const locationsKey = locations
    .map(
      location =>
        `${location.locationNumber}:${location.lat}:${location.lng}:${location.radiusMeters}`
    )
    .join('|')
  const activeLocations = useMemo(
    () => (locations.length > 0 ? [...locations] : []),
    // locations 배열 참조가 매 렌더 바뀌어도 좌표가 같으면 존/동기화 effect를 재실행하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationsKey]
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
    const prev = zoneStateRef.current
    const next = createZoneStateMap(activeLocations)
    for (const location of activeLocations) {
      const existing = prev.get(location.locationNumber)
      if (existing) next.set(location.locationNumber, existing)
    }
    zoneStateRef.current = next
  }, [activeLocations])

  // 페이지 이탈 시 watch만 정리. 토글 OFF로 저장하면 재진입 시 자동 추적이 풀림.
  useEffect(() => {
    return () => {
      clearWatchOnly()
      for (const retry of recordRetryRef.current.values()) {
        if (retry.timerId != null) window.clearTimeout(retry.timerId)
      }
      recordRetryRef.current.clear()
    }
  }, [clearWatchOnly])

  const canUseGps =
    liveTrackingAllowed &&
    verificationChecked &&
    !!userId &&
    gpsTrackingEligible &&
    activeLocations.length > 0

  useEffect(() => {
    canUseGpsRef.current = canUseGps
  }, [canUseGps])

  // 어드민이 GPS를 끄면 진행 중 추적만 중단 (이력 UI는 유지)
  useEffect(() => {
    if (liveTrackingAllowed) return
    clearWatchOnly()
    setTracking(false)
    setCurrentLat(null)
    setCurrentLng(null)
    setDistanceByLocation({})
    autoStartedRef.current = false
  }, [liveTrackingAllowed, clearWatchOnly])

  // 목록/다른 탭에서 토글 OFF → 상세의 watch도 즉시 중단 (이력이 거리 UI에 가려지지 않게)
  useEffect(() => {
    if (storedEnabled) return
    clearWatchOnly()
    setTracking(false)
    setCurrentLat(null)
    setCurrentLng(null)
    setDistanceByLocation({})
    autoStartedRef.current = false
  }, [storedEnabled, clearWatchOnly])

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

    if (userId && verificationChecked && !gpsTrackingEligible) {
      setGpsTrackingEnabled(eventId, false)
      void syncGpsTrackingPref(eventId, false)
    }
  }, [
    canUseGps,
    userId,
    gpsTrackingEligible,
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

  /** gps_logs → 통과 이력 UI. 토글/armed/isInside와 무관 */
  const syncPassHistory = useCallback(async () => {
    try {
      const res = await authFetch(`/api/gps-log?event_id=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (!res.ok) return

      const configuredNumbers = new Set(
        activeLocations.map(location => location.locationNumber)
      )
      const nextPassLog: GpsPassLogGroup[] = []

      for (const group of data.locations ?? []) {
        const locationNumber = parseLocationNumber(group.location_number)
        if (!configuredNumbers.has(locationNumber)) continue

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
      setPassLog(nextPassLog)
    } catch {
      // ignore — 기존 이력 UI 유지
    }
  }, [activeLocations, eventId])

  /**
   * 서버 passCount만 기존 Map 엔트리에 in-place 병합.
   * Map 통째 교체 금지 — await 사이 handlePosition의 armed/isInside를 덮지 않음.
   */
  const syncZonePassCounts = useCallback(async () => {
    try {
      const res = await authFetch(`/api/gps-log?event_id=${encodeURIComponent(eventId)}`)
      const data = await res.json()
      if (!res.ok) return

      const configuredNumbers = new Set(
        activeLocations.map(location => location.locationNumber)
      )

      for (const group of data.locations ?? []) {
        const locationNumber = parseLocationNumber(group.location_number)
        if (!configuredNumbers.has(locationNumber)) continue
        const serverCount = group.pass_count ?? (group.passes ?? []).length
        // 매 set 시점의 최신 ref를 읽어 병합 (루프 중 handlePosition 반영 유지)
        const map = zoneStateRef.current
        map.set(
          locationNumber,
          mergePassCountIntoZoneState(map.get(locationNumber), serverCount)
        )
      }
    } catch {
      // ignore
    }
  }, [activeLocations, eventId])

  const syncPasses = useCallback(async () => {
    await Promise.all([syncPassHistory(), syncZonePassCounts()])
  }, [syncPassHistory, syncZonePassCounts])

  // 토글·실시간 추적과 무관하게, 로그인 사용자는 통과 이력을 항상 불러옴
  useEffect(() => {
    if (!userId) {
      setPassLog([])
      return
    }
    void syncPassHistory()
  }, [userId, syncPassHistory])

  const clearRecordRetry = useCallback((locationNumber: GpsLocationNumber) => {
    const prev = recordRetryRef.current.get(locationNumber)
    if (prev?.timerId != null) {
      window.clearTimeout(prev.timerId)
    }
    recordRetryRef.current.delete(locationNumber)
  }, [])

  /** POST 실패 후: 즉시 재무장하지 않고 쿨다운 뒤 한 번만 재시도 펄스 */
  const scheduleRecordRetry = useCallback((locationNumber: GpsLocationNumber) => {
    const prev = recordRetryRef.current.get(locationNumber)
    if (prev?.timerId != null) {
      window.clearTimeout(prev.timerId)
    }

    const failCount = (prev?.failCount ?? 0) + 1
    const cooldownMs =
      failCount >= RECORD_FAIL_ESCALATE_AFTER
        ? RECORD_FAIL_COOLDOWN_ESCALATED_MS
        : RECORD_FAIL_COOLDOWN_MS
    const cooldownUntil = Date.now() + cooldownMs

    const timerId = window.setTimeout(() => {
      const current = recordRetryRef.current.get(locationNumber)
      if (!current || current.cooldownUntil > Date.now()) return

      const state = zoneStateRef.current.get(locationNumber)
      if (!state) return

      // 아직 반경 안이면 진입 판정을 한 번 더 열어둠 (스팸 없이 쿨다운 후 1회)
      if (state.isInside) {
        zoneStateRef.current.set(locationNumber, {
          ...state,
          isInside: false,
          armedForNextPass: true,
        })
      } else if (!state.armedForNextPass) {
        zoneStateRef.current.set(locationNumber, {
          ...state,
          armedForNextPass: true,
        })
      }

      recordRetryRef.current.set(locationNumber, {
        ...current,
        timerId: null,
        cooldownUntil: 0,
      })
    }, cooldownMs)

    recordRetryRef.current.set(locationNumber, {
      failCount,
      cooldownUntil,
      timerId,
    })
  }, [])

  const applyRecordFailure = useCallback(
    (locationNumber: GpsLocationNumber) => {
      const state = zoneStateRef.current.get(locationNumber)
      if (state) {
        // 카운트만 롤백. isInside는 유지하고 armed는 꺼 두어 폴링마다 재POST하지 않음.
        zoneStateRef.current.set(locationNumber, {
          ...state,
          passCount: Math.max(0, state.passCount - 1),
          armedForNextPass: false,
        })
      }
      scheduleRecordRetry(locationNumber)
    },
    [scheduleRecordRetry]
  )

  const isRecordCooldownActive = useCallback((locationNumber: GpsLocationNumber) => {
    const retry = recordRetryRef.current.get(locationNumber)
    return !!retry && Date.now() < retry.cooldownUntil
  }, [])

  const recordPass = useCallback(
    async (latitude: number, longitude: number, locationNumber: GpsLocationNumber) => {
      if (!canUseGpsRef.current) return
      if (isRecordCooldownActive(locationNumber)) return

      // 위치당 in-flight 1건만 — watchPosition/폴링 중복 POST 차단
      const lockKey = String(locationNumber)
      if (recordingRef.current.has(lockKey)) return
      recordingRef.current.add(lockKey)

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
          applyRecordFailure(locationNumber)
          setErrorMsg(data.error ?? '통과 기록 저장 실패')
          return
        }

        clearRecordRetry(locationNumber)

        // 히스테리시스는 이미 진입 시점에 반영됨. 이력 UI만 갱신.
        const serverCount =
          typeof data.pass_count === 'number'
            ? data.pass_count
            : zoneStateRef.current.get(locationNumber)?.passCount
        if (typeof serverCount === 'number') {
          const map = zoneStateRef.current
          map.set(
            locationNumber,
            mergePassCountIntoZoneState(map.get(locationNumber), serverCount)
          )
        }
        void syncPassHistory()
      } catch {
        applyRecordFailure(locationNumber)
        setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
      } finally {
        recordingRef.current.delete(lockKey)
      }
    },
    [
      applyRecordFailure,
      clearRecordRetry,
      eventId,
      isRecordCooldownActive,
      syncPassHistory,
    ]
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

      // 설정된 1·2·3차 위치를 동일 규칙으로 독립 순회
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
          createInitialGpsPassZoneState(0)

        // POST 중이어도 이탈/재무장 판정은 반드시 진행 (continue로 스킵하면 재진입이 막힘)
        const { state, shouldRecord } = nextGpsPassZoneState(currentState, distance, {
          enterRadius: location.radiusMeters,
          exitRadius,
        })

        if (shouldRecord && isRecordCooldownActive(location.locationNumber)) {
          // 쿨다운 중: 진입으로 간주하되 카운트/POST는 하지 않음
          zoneStateRef.current.set(location.locationNumber, {
            ...currentState,
            isInside: true,
            armedForNextPass: false,
          })
        } else {
          zoneStateRef.current.set(location.locationNumber, state)

          if (
            shouldRecord &&
            !recordingRef.current.has(String(location.locationNumber))
          ) {
            void recordPass(latitude, longitude, location.locationNumber)
          }
        }
      }

      setDistanceByLocation(nextDistances)

      // 어느 위치든 반경×3 근접이면 폴링 강화 (위치 공통, 판정은 위 루프에서 각각)
      if (isNearAnyZone) {
        startNearZonePolling()
      } else {
        stopNearZonePolling()
      }
    },
    [
      activeLocations,
      clearWatchOnly,
      isRecordCooldownActive,
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
    void syncPasses()

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
  }, [canUseGps, eventId, handlePosition, stopTracking, syncPasses])

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

  // 실시간 거리: 토글 ON + 실제 watch 중일 때만
  // 통과 이력: gps_logs 있으면 토글 OFF·추적 중단 상태에서도 항상 (armed/isInside와 무관)
  const showLiveTracking =
    liveTrackingAllowed && !!userId && tracking && storedEnabled
  const showPassHistory = !showLiveTracking && passLog.length > 0
  const isTrackingOn = showLiveTracking || (liveTrackingAllowed && !!userId && storedEnabled)

  return (
    <>
      <div className="card-section" data-event-name={eventName}>
        <div className="toggle-row mb-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">📍 촬영 감지</p>
            <p className="mt-1 text-xs text-muted">
              촬영 위치 {activeLocations.length}곳 · 진입/이탈마다 통과 기록
            </p>
          </div>
          <span
            className={`text-xs font-semibold ${isTrackingOn ? 'text-success' : 'text-muted'}`}
          >
            {isTrackingOn ? '🟢 CAPTURING' : '⚪ 꺼짐'}
          </span>
        </div>

        {showLiveTracking ? (
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

        {showPassHistory ? (
          <div className="gps-pass-history" aria-label="촬영 통과 기록">
            {passLog.map(group => {
              const multiLocation = activeLocations.length > 1 || passLog.length > 1
              const multiPass = group.passes.length > 1
              return (
                <div key={group.location_number} className="gps-distance-block">
                  {multiLocation ? (
                    <p className="gps-pass-history-location">
                      {group.location_number}차 촬영 위치
                    </p>
                  ) : null}
                  {group.passes.map(pass => (
                    <p
                      key={`${group.location_number}-${pass.pass_count}-${pass.display_time}`}
                      className="gps-pass-complete-time"
                    >
                      {multiPass
                        ? `${pass.pass_count}차 ${pass.display_time} 촬영 완료`
                        : `${pass.display_time} 촬영 완료`}
                    </p>
                  ))}
                </div>
              )
            })}
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

        {verificationChecked && !gpsTrackingEligible && (
          <p className="text-xs text-muted">
            <Link
              href={`/verify-order?eventId=${encodeURIComponent(eventId)}`}
              className="text-xs text-muted underline"
            >
              구매 인증 후 이용 가능해요
            </Link>
          </p>
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
