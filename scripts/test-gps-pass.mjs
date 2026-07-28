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

let state = createInitialGpsPassZoneState(0)

// enter — record once
let result = nextGpsPassZoneState(state, 40)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCount, 1)
assert.equal(state.armedForNextPass, false)
assert.equal(state.isInside, true)

// still inside / hysteresis band — no duplicate
result = nextGpsPassZoneState(state, 30)
assert.equal(result.shouldRecord, false)
result = nextGpsPassZoneState(state, 70)
assert.equal(result.shouldRecord, false)
state = result.state
assert.equal(state.passCount, 1)
assert.equal(state.armedForNextPass, false)

// exit — re-arm only, no record
result = nextGpsPassZoneState(state, 120)
assert.equal(result.shouldRecord, false)
state = result.state
assert.equal(state.armedForNextPass, true)
assert.equal(state.isInside, false)

// re-enter — record again
result = nextGpsPassZoneState(state, 20)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCount, 2)

// simulate bad sync that used to reset armed while still inside
state = { isInside: true, armedForNextPass: false, passCount: 2 }
result = nextGpsPassZoneState(state, 35)
assert.equal(result.shouldRecord, false)
assert.equal(result.state.passCount, 2)

// many cycles
state = createInitialGpsPassZoneState(0)
for (let i = 0; i < 7; i++) {
  result = nextGpsPassZoneState(state, 25)
  assert.equal(result.shouldRecord, true)
  state = result.state
  result = nextGpsPassZoneState(state, 140)
  assert.equal(result.shouldRecord, false)
  state = result.state
}
assert.equal(state.passCount, 7)

console.log('gps-pass enter-record + exit-rearm: ok')
