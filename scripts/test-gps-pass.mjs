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

let result = nextGpsPassZoneState(state, 40)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCount, 1)
assert.equal(state.armedForNextPass, false)

// still inside — no second record
result = nextGpsPassZoneState(state, 30)
assert.equal(result.shouldRecord, false)

result = nextGpsPassZoneState(state, 120)
state = result.state
assert.equal(state.armedForNextPass, true)

result = nextGpsPassZoneState(state, 30)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCount, 2)

// unlimited: keep cycling past former max of 3
for (let i = 0; i < 5; i++) {
  result = nextGpsPassZoneState(state, 150)
  state = result.state
  result = nextGpsPassZoneState(state, 20)
  assert.equal(result.shouldRecord, true)
  state = result.state
}
assert.equal(state.passCount, 7)

console.log('gps-pass unlimited enter/exit cycles: ok')
