import fs from 'node:fs'
import assert from 'node:assert/strict'

const env = fs.readFileSync('.env.local', 'utf8')
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const adminToken = envVal('ADMIN_PASSWORD')

const eventsRes = await fetch(`${baseUrl}/api/admin/events`, {
  headers: { 'x-admin-token': adminToken },
})
assert.equal(eventsRes.status, 200, 'admin events should load')
const eventsData = await eventsRes.json()
const eventId = eventsData.events?.[0]?.id
assert.ok(eventId, 'event required')

const monitorRes = await fetch(
  `${baseUrl}/api/admin/event-monitoring?event_id=${encodeURIComponent(eventId)}`,
  { headers: { 'x-admin-token': adminToken } }
)
assert.equal(monitorRes.status, 200, 'event monitoring should load')
const monitorData = await monitorRes.json()
assert.ok(Array.isArray(monitorData.rows), 'rows array required')

if (monitorData.rows.length > 0) {
  const row = monitorData.rows[0]
  assert.ok('player_label' in row)
  assert.ok('gps_passed' in row)
  assert.ok('pass_count' in row || row.pass_count === null)
  assert.ok('notified' in row)
}

const listRes = await fetch(`${baseUrl}/api/events/list`)
assert.equal(listRes.status, 200)
const listData = await listRes.json()
for (const event of listData.past ?? []) {
  if (event.shoot_record) {
    assert.ok(typeof event.shoot_record.username === 'string')
    assert.match(event.shoot_record.time, /^\d{2}:\d{2}$/)
    assert.doesNotMatch(event.shoot_record.username, /@/)
  }
}

console.log('event-monitoring API tests passed')
