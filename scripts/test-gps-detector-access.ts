/**
 * GpsDetector 추적 게이트 — 앨범 접근(status===valid)과 별개.
 * Run: npx tsx scripts/test-gps-detector-access.ts
 */

function canUseGps(options: {
  liveTrackingAllowed: boolean
  verificationChecked: boolean
  userId: string | null
  gpsTrackingEligible: boolean
  hasLocations: boolean
}): boolean {
  return (
    options.liveTrackingAllowed &&
    options.verificationChecked &&
    !!options.userId &&
    options.gpsTrackingEligible &&
    options.hasLocations
  )
}

const base = {
  liveTrackingAllowed: true,
  verificationChecked: true,
  userId: 'u1' as string | null,
  gpsTrackingEligible: true,
  hasLocations: true,
}

const cases = [
  { name: 'no login', opts: { ...base, userId: null }, expect: false },
  { name: 'not eligible', opts: { ...base, gpsTrackingEligible: false }, expect: false },
  {
    name: 'purchase or instagram ok',
    opts: { ...base, gpsTrackingEligible: true },
    expect: true,
  },
  { name: 'loading', opts: { ...base, verificationChecked: false }, expect: false },
  {
    name: 'gps logs only (album ok, toggle no)',
    opts: { ...base, gpsTrackingEligible: false },
    expect: false,
  },
  { name: 'no locations', opts: { ...base, hasLocations: false }, expect: false },
  { name: 'admin gps off', opts: { ...base, liveTrackingAllowed: false }, expect: false },
]

let passed = 0
for (const c of cases) {
  const result = canUseGps(c.opts)
  const ok = result === c.expect
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${result} (expected ${c.expect})`)
  if (ok) passed++
}

console.log(`\n${passed}/${cases.length} passed`)
process.exit(passed === cases.length ? 0 : 1)
