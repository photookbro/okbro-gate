import assert from 'node:assert/strict'

const GPS_ENTER_RADIUS_METERS = 50
const GPS_EXIT_RADIUS_METERS = 100
const MAX_GPS_PASSES_PER_DAY = 3

function createInitialGpsPassZoneState(passCountToday = 0) {
  return {
    isInside: false,
    armedForNextPass: passCountToday < MAX_GPS_PASSES_PER_DAY,
    passCountToday,
  }
}

function nextGpsPassZoneState(state, distanceMeters) {
  return nextGpsPassZoneStateWithOptions(state, distanceMeters)
}

function nextGpsPassZoneStateWithOptions(state, distanceMeters, options = {}) {
  let next = { ...state }
  let shouldRecord = false
  const maxPasses = options.maxPasses ?? MAX_GPS_PASSES_PER_DAY

  if (distanceMeters <= GPS_ENTER_RADIUS_METERS) {
    if (!next.isInside && next.armedForNextPass && next.passCountToday < maxPasses) {
      shouldRecord = true
      next.passCountToday += 1
      next.armedForNextPass = false
    }
    next.isInside = true
  } else if (distanceMeters >= GPS_EXIT_RADIUS_METERS) {
    next.isInside = false
    next.armedForNextPass = next.passCountToday < maxPasses
  }

  return { state: next, shouldRecord }
}

let state = createInitialGpsPassZoneState(0)

let result = nextGpsPassZoneState(state, 40)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCountToday, 1)

result = nextGpsPassZoneState(state, 120)
state = result.state
result = nextGpsPassZoneState(state, 30)
assert.equal(result.shouldRecord, true)
state = result.state
assert.equal(state.passCountToday, 2)

result = nextGpsPassZoneState(state, 150)
state = result.state
result = nextGpsPassZoneState(state, 20)
state = result.state
assert.equal(state.passCountToday, 3)

result = nextGpsPassZoneState(state, 150)
state = result.state
result = nextGpsPassZoneState(state, 20)
assert.equal(result.shouldRecord, false)

console.log('gps-pass state machine: ok')

let state1 = createInitialGpsPassZoneState(0)
let r1 = nextGpsPassZoneStateWithOptions(state1, 40, { maxPasses: 1 })
assert.equal(r1.shouldRecord, true)
state1 = r1.state
assert.equal(state1.passCountToday, 1)

r1 = nextGpsPassZoneStateWithOptions(state1, 150, { maxPasses: 1 })
state1 = r1.state
r1 = nextGpsPassZoneStateWithOptions(state1, 40, { maxPasses: 1 })
assert.equal(r1.shouldRecord, false)
console.log('gps-pass non-loop (maxPasses=1): ok')
