import assert from 'node:assert/strict'
import {
  formatOrderHistoryDate,
  formatVerificationDate,
} from '../src/lib/order-verification.ts'

assert.equal(formatOrderHistoryDate('2024-06-15-12345678-12345678'), '2024-06-15')
assert.equal(formatOrderHistoryDate('ORDER-XYZ', '2024-06-15T10:00:00.000Z'), '2024-06-15')
assert.equal(formatOrderHistoryDate('ORDER-XYZ'), 'ORDER-XYZ')
assert.ok(formatVerificationDate('2026-06-15').includes('2026'))

console.log('mypage UI helper tests passed')
