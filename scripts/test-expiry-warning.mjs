import assert from 'node:assert/strict'
import { isUserExpiringSoon, USER_EXPIRY_WARNING_DAYS } from '../src/lib/order-verification.ts'

assert.equal(USER_EXPIRY_WARNING_DAYS, 7)

const now = new Date('2025-06-15T12:00:00+09:00')
const inFiveDays = new Date('2025-06-20T12:00:00+09:00')
const inTenDays = new Date('2025-06-25T12:00:00+09:00')

assert.equal(isUserExpiringSoon(inFiveDays, now), true)
assert.equal(isUserExpiringSoon(inTenDays, now), false)

console.log('order-verification expiry tests passed')
