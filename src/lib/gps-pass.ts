export const GPS_ENTER_RADIUS_METERS = 50
export const GPS_EXIT_RADIUS_METERS = 100
export const MAX_GPS_PASSES_PER_DAY = 3

export function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export type GpsPassZoneState = {
  isInside: boolean
  armedForNextPass: boolean
  passCountToday: number
}

export function createInitialGpsPassZoneState(
  passCountToday = 0,
  options?: { maxPasses?: number }
): GpsPassZoneState {
  const maxPasses = options?.maxPasses ?? MAX_GPS_PASSES_PER_DAY
  return {
    isInside: false,
    armedForNextPass: passCountToday < maxPasses,
    passCountToday,
  }
}

/** 진입/이탈 거리로 다음 POST 가능 여부 갱신 */
export function nextGpsPassZoneState(
  state: GpsPassZoneState,
  distanceMeters: number,
  options?: { enterRadius?: number; exitRadius?: number; maxPasses?: number }
): { state: GpsPassZoneState; shouldRecord: boolean } {
  const enterRadius = options?.enterRadius ?? GPS_ENTER_RADIUS_METERS
  const exitRadius = options?.exitRadius ?? GPS_EXIT_RADIUS_METERS
  const maxPasses = options?.maxPasses ?? MAX_GPS_PASSES_PER_DAY

  const next = { ...state }
  let shouldRecord = false

  if (distanceMeters <= enterRadius) {
    if (
      !next.isInside &&
      next.armedForNextPass &&
      next.passCountToday < maxPasses
    ) {
      shouldRecord = true
      next.passCountToday += 1
      next.armedForNextPass = false
    }
    next.isInside = true
  } else if (distanceMeters >= exitRadius) {
    next.isInside = false
    next.armedForNextPass = next.passCountToday < maxPasses
  }

  return { state: next, shouldRecord }
}
