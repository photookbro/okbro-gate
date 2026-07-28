import assert from 'node:assert/strict'

const GPS_ENTER_RADIUS_METERS = 50
const GPS_EXIT_RADIUS_METERS = 100

function createInitialGpsPassZoneState(passCount = 0) {
  return {
    isInside: false,
    armedForNextPass: true,
    passCount,
  }
}

function nextGpsPassZoneState(state, distanceMeters, options = {}) {
  const enterRadius = options.enterRadius ?? GPS_ENTER_RADIUS_METERS
  const exitRadius = options.exitRadius ?? GPS_EXIT_RADIUS_METERS
  let next = { ...state }
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

function mergePassCountIntoZoneState(state, passCount) {
  if (!state) return createInitialGpsPassZoneState(passCount)
  return { ...state, passCount }
}

/** syncZonePassCounts in-place: same Map identity, only passCount changes */
function syncZonePassCountsInPlace(map, serverCounts) {
  for (const [locationNumber, serverCount] of serverCounts) {
    map.set(
      locationNumber,
      mergePassCountIntoZoneState(map.get(locationNumber), serverCount)
    )
  }
}

// --- per-location independent maps ---
const zoneByLocation = new Map([
  [1, createInitialGpsPassZoneState(0)],
  [2, createInitialGpsPassZoneState(0)],
])

let r = nextGpsPassZoneState(zoneByLocation.get(1), 40)
zoneByLocation.set(1, r.state)
assert.equal(r.shouldRecord, true)
assert.equal(zoneByLocation.get(1).armedForNextPass, false)

// location 2 still armed independently
r = nextGpsPassZoneState(zoneByLocation.get(2), 40)
assert.equal(r.shouldRecord, true)
zoneByLocation.set(2, r.state)

// loc1 still disarmed while inside
r = nextGpsPassZoneState(zoneByLocation.get(1), 30)
assert.equal(r.shouldRecord, false)

// exit loc1 → re-arm
r = nextGpsPassZoneState(zoneByLocation.get(1), 120)
assert.equal(r.shouldRecord, false)
zoneByLocation.set(1, r.state)
assert.equal(zoneByLocation.get(1).armedForNextPass, true)

// re-enter loc1
r = nextGpsPassZoneState(zoneByLocation.get(1), 20)
assert.equal(r.shouldRecord, true)
assert.equal(r.state.passCount, 2)
zoneByLocation.set(1, r.state)

// stale sync must not re-arm while still inside (the production bug)
let live = { isInside: true, armedForNextPass: false, passCount: 1 }
live = mergePassCountIntoZoneState(live, 1)
assert.equal(live.armedForNextPass, false)
assert.equal(live.isInside, true)
r = nextGpsPassZoneState(live, 35)
assert.equal(r.shouldRecord, false)

// in-place merge keeps Map identity + hysteresis after exit during "await"
const mapRef = zoneByLocation
const mapBefore = mapRef
mapRef.set(1, { isInside: true, armedForNextPass: false, passCount: 2 })
// simulate exit during await
mapRef.set(1, { isInside: false, armedForNextPass: true, passCount: 2 })
syncZonePassCountsInPlace(mapRef, new Map([[1, 2], [2, 1]]))
assert.equal(mapRef, mapBefore)
assert.equal(mapRef.get(1).armedForNextPass, true)
assert.equal(mapRef.get(1).isInside, false)
assert.equal(mapRef.get(1).passCount, 2)
assert.equal(mapRef.get(2).passCount, 1)
assert.equal(mapRef.get(2).armedForNextPass, false)

// POST failure: keep armed false while inside (no immediate spam), then pulse after cooldown
function applyRecordFailure(state) {
  return {
    ...state,
    passCount: Math.max(0, state.passCount - 1),
    armedForNextPass: false,
  }
}
function pulseRetryAfterCooldown(state) {
  if (state.isInside) {
    return { ...state, isInside: false, armedForNextPass: true }
  }
  return state.armedForNextPass ? state : { ...state, armedForNextPass: true }
}

let failed = applyRecordFailure({
  isInside: true,
  armedForNextPass: false,
  passCount: 3,
})
assert.equal(failed.passCount, 2)
assert.equal(failed.armedForNextPass, false)
assert.equal(failed.isInside, true)
r = nextGpsPassZoneState(failed, 20)
assert.equal(r.shouldRecord, false) // no spam while cooldown / disarmed

const pulsed = pulseRetryAfterCooldown(failed)
r = nextGpsPassZoneState(pulsed, 20)
assert.equal(r.shouldRecord, true)

console.log('gps-pass per-location + in-place sync + retry cooldown: ok')
