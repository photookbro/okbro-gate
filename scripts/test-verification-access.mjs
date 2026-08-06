/**
 * Manual: node scripts/test-verification-access.mjs
 * Purchase-only photo access summary checks
 */
import assert from 'node:assert/strict'
import {
  buildPhotoAccessSummary,
  getNonNegativeDaysRemaining,
} from '../src/lib/verification-access.ts'
import { addDays } from '../src/lib/order-verification.ts'

const now = new Date('2026-02-15T12:00:00+09:00')
const purchaseExpires = addDays(now, 25)

const summary = buildPhotoAccessSummary(
  [
    {
      order_number: '2026020101010123',
      used_at: now.toISOString(),
      expires_at: purchaseExpires.toISOString(),
    },
  ],
  30,
  now
)

assert.equal(summary.purchase.days_remaining, 25)
assert.equal(summary.photo_access_days_remaining, 25)
assert.equal(summary.status, 'valid')

assert.equal(getNonNegativeDaysRemaining(addDays(now, -1), now), 0)

console.log('verification-access tests passed')
