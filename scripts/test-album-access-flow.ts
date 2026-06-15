/**
 * Album B download flow decision test
 * Run: npx tsx scripts/test-album-access-flow.ts
 */
import { resolveAlbumBDownloadAction } from '../src/lib/album-access'
import type { VerificationInfo } from '../src/lib/order-verification'

function v(partial: Partial<VerificationInfo>): VerificationInfo {
  return { status: 'none', ...partial }
}

const cases = [
  {
    name: 'not app installed',
    verification: v({ purchase_verified: true }),
    appInstalled: false,
    expect: 'app-install',
  },
  {
    name: 'gps access',
    verification: v({
      status: 'valid',
      access_source: 'gps',
      gps_passed_at: '2026-01-01T14:32:45Z',
      purchase_verified: false,
    }),
    appInstalled: true,
    expect: 'open-album',
  },
  {
    name: 'purchase only',
    verification: v({
      status: 'valid',
      access_source: 'purchase',
      purchase_verified: true,
    }),
    appInstalled: true,
    expect: 'gps-hint',
  },
  {
    name: 'no access',
    verification: v({ status: 'none', purchase_verified: false }),
    appInstalled: true,
    expect: 'verify-order',
  },
]

let passed = 0
for (const c of cases) {
  const result = resolveAlbumBDownloadAction(c.verification, c.appInstalled)
  const ok = result === c.expect
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${result} (expected ${c.expect})`)
  if (ok) passed++
}

console.log(`\n${passed}/${cases.length} passed`)
process.exit(passed === cases.length ? 0 : 1)
