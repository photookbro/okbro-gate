/**
 * GPS pass validation logic test (mirrors /api/gps-log server checks)
 * Run: npx tsx scripts/test-gps-log.ts
 */
import { haversineDistance } from '../src/lib/geo'

const CENTER_LAT = 37.5665
const CENTER_LNG = 126.978
const RADIUS = 50

function validatePass(userLat: number, userLng: number) {
  const distance = haversineDistance(userLat, userLng, CENTER_LAT, CENTER_LNG)
  if (distance > RADIUS) {
    return { ok: false as const, status: 400, distance: Math.round(distance) }
  }
  return { ok: true as const, status: 200, distance: Math.round(distance) }
}

const cases = [
  { name: 'same point (insert)', lat: 37.5665, lng: 126.978, expect: 200 },
  { name: '~30m inside', lat: 37.56677, lng: 126.978, expect: 200 },
  { name: '~80m outside', lat: 37.56722, lng: 126.978, expect: 400 },
]

let passed = 0
for (const c of cases) {
  const result = validatePass(c.lat, c.lng)
  const status = result.ok ? 200 : 400
  const ok = status === c.expect
  console.log(`${ok ? '✅' : '❌'} ${c.name}: distance=${result.distance}m → ${status} (expected ${c.expect})`)
  if (ok) passed++
}

console.log(`\n${passed}/${cases.length} validation cases passed`)
process.exit(passed === cases.length ? 0 : 1)
