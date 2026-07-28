export const GPS_ENTER_RADIUS_METERS = 50
export const GPS_EXIT_RADIUS_METERS = 100

export type GpsPassZoneState = {
  isInside: boolean
  /** false면 반경 안에 있어도 기록하지 않음 — 이탈 후에만 다시 true */
  armedForNextPass: boolean
  /** 이 세션(또는 동기화)에서 기록된 통과 횟수. 상한 없음 */
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
 * 진입(enterRadius) → 이탈(exitRadius) 사이클마다 1회 카운트.
 * 상한·날짜 리셋 없음 — 이탈 후 재진입만 되면 계속 기록.
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
