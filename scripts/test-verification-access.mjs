import assert from 'node:assert/strict'
import {
  buildPhotoAccessSummary,
  getNonNegativeDaysRemaining,
  isHipassOrderNumber,
} from '../src/lib/verification-access.ts'
import { addDays } from '../src/lib/order-verification.ts'

assert.equal(isHipassOrderNumber('HIPASS123', 'hipass123'), true)
assert.equal(isHipassOrderNumber('2024-01010101-12345678', 'hipass123'), false)

const now = new Date('2026-02-15T12:00:00+09:00')
const hipassExpires = addDays(now, 1)
const purchaseExpires = addDays(now, 25)

const summary = buildPhotoAccessSummary(
  [
    {
      order_number: 'HIPASS',
      used_at: now.toISOString(),
      expires_at: hipassExpires.toISOString(),
    },
    {
      order_number: '2026-02010101-12345678',
      used_at: now.toISOString(),
      expires_at: purchaseExpires.toISOString(),
    },
  ],
  'HIPASS',
  30,
  180,
  now
)

assert.equal(summary.hipass.days_remaining, 1)
assert.equal(summary.purchase.days_remaining, 25)
assert.equal(summary.photo_access_days_remaining, 26)
assert.equal(summary.status, 'valid')

assert.equal(getNonNegativeDaysRemaining(addDays(now, -1), now), 0)

console.log('verification-access tests passed')
