import fs from 'node:fs'
import assert from 'node:assert/strict'

const env = fs.readFileSync('.env.local', 'utf8')
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const adminToken = envVal('ADMIN_PASSWORD')

const playersRes = await fetch(`${baseUrl}/api/admin/players`, {
  headers: { 'x-admin-token': adminToken },
})
const playersText = await playersRes.text()
assert.equal(playersRes.status, 200, `admin players should load: ${playersText}`)
const playersData = JSON.parse(playersText)
const playerId = playersData.players?.[0]?.id
assert.ok(playerId, 'player required')

const detailRes = await fetch(
  `${baseUrl}/api/admin/players?user_id=${encodeURIComponent(playerId)}`,
  { headers: { 'x-admin-token': adminToken } }
)
assert.equal(detailRes.status, 200, 'player detail should load')
const detailData = await detailRes.json()

for (const order of detailData.player?.orders ?? []) {
  assert.equal(typeof order.is_duplicate, 'boolean')
  assert.equal(typeof order.duplicate_count, 'number')
  assert.ok(Array.isArray(order.duplicate_users))
  for (const user of order.duplicate_users) {
    assert.ok(user.user_id)
    assert.ok(typeof user.email === 'string')
  }
}

const mypageRes = await fetch(`${baseUrl}/api/mypage`)
assert.ok(
  mypageRes.status === 401 || mypageRes.status === 404,
  `mypage should reject unauthenticated requests (${mypageRes.status})`
)

console.log('order-duplicate API shape tests passed')
