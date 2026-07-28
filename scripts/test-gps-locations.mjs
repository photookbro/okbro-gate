import assert from 'node:assert/strict'

function getEventGpsLocations(event) {
  const locations = []
  const lat1 = event.gps_1_lat ?? event.gps_lat
  const lng1 = event.gps_1_lng ?? event.gps_lng
  if (lat1 != null && lng1 != null) {
    locations.push({
      locationNumber: 1,
      lat: lat1,
      lng: lng1,
      radiusMeters: event.gps_1_radius_meters ?? event.gps_radius_meters ?? 50,
    })
  }
  if (event.gps_2_lat != null && event.gps_2_lng != null) {
    locations.push({
      locationNumber: 2,
      lat: event.gps_2_lat,
      lng: event.gps_2_lng,
      radiusMeters: event.gps_2_radius_meters ?? 50,
    })
  }
  if (event.gps_3_lat != null && event.gps_3_lng != null) {
    locations.push({
      locationNumber: 3,
      lat: event.gps_3_lat,
      lng: event.gps_3_lng,
      radiusMeters: event.gps_3_radius_meters ?? 50,
    })
  }
  return locations
}

function getGpsLocationLabel(locationNumber, locationCount) {
  if (locationCount <= 1) return '촬영 위치'
  return `${locationNumber}차 촬영 위치`
}

function buildGpsLogsByLocation(logs, locationNumbers) {
  const numbers = locationNumbers.length > 0 ? locationNumbers : [1]
  const locationCount = numbers.length
  return numbers.map(locationNumber => {
    const locationLogs = logs.filter(log => (log.location_number ?? 1) === locationNumber)
    const byPassCount = new Map()
    for (const log of locationLogs) {
      const count = log.pass_count ?? 1
      if (!log.passed_at || byPassCount.has(count)) continue
      byPassCount.set(count, log.passed_at)
    }
    const passes = [...byPassCount.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([passCount, passedAt]) => ({
        pass_count: passCount,
        passed_at_display: passedAt.slice(11, 19),
      }))
    return {
      location_number: locationNumber,
      label: getGpsLocationLabel(locationNumber, locationCount),
      passes,
    }
  })
}

const locations = getEventGpsLocations({
  gps_1_lat: 37.1,
  gps_1_lng: 127.1,
  gps_2_lat: 37.2,
  gps_2_lng: 127.2,
  gps_3_lat: 37.3,
  gps_3_lng: 127.3,
})
assert.equal(locations.length, 3)
assert.equal(locations[2].locationNumber, 3)

const without3 = getEventGpsLocations({
  gps_1_lat: 37.1,
  gps_1_lng: 127.1,
})
assert.equal(without3.length, 1)

const grouped = buildGpsLogsByLocation(
  [
    { location_number: 1, pass_count: 1, passed_at: '2025-06-08T04:20:30.000Z' },
    { location_number: 1, pass_count: 2, passed_at: '2025-06-08T05:45:15.000Z' },
    { location_number: 1, pass_count: 4, passed_at: '2025-06-08T06:00:00.000Z' },
    { location_number: 2, pass_count: 1, passed_at: '2025-06-08T04:35:10.000Z' },
  ],
  [1, 2]
)

assert.equal(grouped.length, 2)
assert.equal(grouped[0].label, '1차 촬영 위치')
assert.equal(grouped[0].passes.length, 3)
assert.equal(grouped[0].passes[2].pass_count, 4)
assert.equal(grouped[1].label, '2차 촬영 위치')

console.log('gps locations 1/2/3 + unlimited passes: ok')
