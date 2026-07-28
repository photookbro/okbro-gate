export const GPS_ENTER_RADIUS_METERS = 50
export const GPS_EXIT_RADIUS_METERS = 100

export type GpsPassZoneState = {
  /** enterRadius 안 — exitRadius 밖 사이에서의 구역 상태 */
  isInside: boolean
  /**
   * true일 때만 다음 진입을 기록할 수 있음.
   * 진입 기록 직후 false, exitRadius 이탈 후에만 다시 true.
   */
  armedForNextPass: boolean
  /** 누적 통과 횟수(상한 없음). 서버 동기화 시 갱신 */
  passCount: number
}

export function createInitialGpsPassZoneState(passCount = 0): GpsPassZoneState {
  return {
    isInside: false,
    armedForNextPass: true,
    passCount,
  }
}

/**
 * 진입(enterRadius) 시점에 1회 기록 → 이탈(exitRadius) 전까지 재무장 안 함.
 * enter~exit 히스테리시스 밴드에서는 상태를 바꾸지 않아 GPS 흔들림 중복을 막음.
 *
 * 모든 location_number에 동일하게 적용 — 위치별 독립 상태는 호출측 Map에서 관리.
 */
export function nextGpsPassZoneState(
  state: GpsPassZoneState,
  distanceMeters: number,
  options?: { enterRadius?: number; exitRadius?: number }
): { state: GpsPassZoneState; shouldRecord: boolean } {
  const enterRadius = options?.enterRadius ?? GPS_ENTER_RADIUS_METERS
  const exitRadius = options?.exitRadius ?? GPS_EXIT_RADIUS_METERS

  const next = { ...state }
  let shouldRecord = false

  if (distanceMeters <= enterRadius) {
    if (!next.isInside && next.armedForNextPass) {
      shouldRecord = true
      next.passCount += 1
      next.armedForNextPass = false
    }
    next.isInside = true
  } else if (distanceMeters >= exitRadius) {
    next.isInside = false
    next.armedForNextPass = true
  }

  return { state: next, shouldRecord }
}

/** 서버 passCount만 반영. isInside/armed 히스테리시스는 절대 덮어쓰지 않음 */
export function mergePassCountIntoZoneState(
  state: GpsPassZoneState | undefined,
  passCount: number
): GpsPassZoneState {
  if (!state) {
    return createInitialGpsPassZoneState(passCount)
  }
  return {
    ...state,
    passCount,
  }
}
