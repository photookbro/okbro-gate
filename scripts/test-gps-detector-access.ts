/**
 * GpsDetector canUseGps logic test
 * Run: npx tsx scripts/test-gps-detector-access.ts
 */

function canUseGps(
  verificationChecked: boolean,
  userId: string | null,
  purchaseVerified: boolean
): boolean {
  return verificationChecked && !!userId && purchaseVerified
}

const cases = [
  { name: 'no login', checked: true, userId: null, purchase: false, expect: false },
  { name: 'no purchase', checked: true, userId: 'u1', purchase: false, expect: false },
  { name: 'purchase ok', checked: true, userId: 'u1', purchase: true, expect: true },
  { name: 'loading', checked: false, userId: 'u1', purchase: true, expect: false },
  { name: 'gps only (no purchase)', checked: true, userId: 'u1', purchase: false, expect: false },
]

let passed = 0
for (const c of cases) {
  const result = canUseGps(c.checked, c.userId, c.purchase)
  const ok = result === c.expect
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${result} (expected ${c.expect})`)
  if (ok) passed++
}

console.log(`\n${passed}/${cases.length} passed`)
process.exit(passed === cases.length ? 0 : 1)
