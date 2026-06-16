import assert from 'node:assert/strict'

const MAX_GPS_PASSES_PER_DAY = 3

function formatPassTimeSeconds(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function buildGpsPassSlots(logs, maxPasses) {
  const byPassCount = new Map()
  for (const log of logs) {
    const count = log.pass_count ?? 1
    if (!log.passed_at || byPassCount.has(count)) continue
    byPassCount.set(count, { passed_at: log.passed_at, notified: log.notified === true })
  }

  return Array.from({ length: maxPasses }, (_, i) => {
    const passCount = i + 1
    const found = byPassCount.get(passCount)
    if (!found) {
      return { pass_count: passCount, passed_at_display: null, notified: null }
    }
    return {
      pass_count: passCount,
      passed_at_display: formatPassTimeSeconds(new Date(found.passed_at)),
      notified: found.notified,
    }
  })
}

const slots = buildGpsPassSlots(
  [
    { pass_count: 1, passed_at: '2025-06-08T04:20:30.000Z', notified: true },
    { pass_count: 2, passed_at: '2025-06-08T05:45:15.000Z', notified: true },
  ],
  MAX_GPS_PASSES_PER_DAY
)

assert.equal(slots.length, 3)
assert.ok(slots[0].passed_at_display)
assert.equal(slots[0].notified, true)
assert.ok(slots[1].passed_at_display)
assert.equal(slots[2].passed_at_display, null)
assert.equal(slots[2].notified, null)

console.log('admin-players gps slots: ok')
