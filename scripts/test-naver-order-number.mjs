import assert from 'node:assert/strict'
import {
  INVALID_NAVER_ORDER_MESSAGE,
  NAVER_ORDER_PLACEHOLDER,
  NAVER_ORDER_TOO_OLD_MESSAGE,
  isNaverOrderDateWithinRecentDays,
  parseNaverOrderDate,
  validateNaverOrderNumber,
} from '../src/lib/naver-order-number.ts'
import { formatOrderHistoryDate } from '../src/lib/order-verification.ts'

assert.equal(NAVER_ORDER_PLACEHOLDER, 'xxxxxxxxxxxxxxxx')

const today = new Date('2025-02-15T12:00:00+09:00')

assert.equal(parseNaverOrderDate('2025021512345678')?.getDate(), 15)
assert.equal(parseNaverOrderDate('202502151234567'), null)
assert.equal(parseNaverOrderDate('20250215123456789'), null)
assert.equal(parseNaverOrderDate('2025021A12345678'), null)
assert.equal(parseNaverOrderDate('2025023012345678'), null)

assert.equal(isNaverOrderDateWithinRecentDays(new Date(2025, 1, 12), 3, today), true)
assert.equal(isNaverOrderDateWithinRecentDays(new Date(2025, 1, 11), 3, today), false)
assert.equal(isNaverOrderDateWithinRecentDays(new Date(2025, 1, 15), 3, today), true)

const valid = validateNaverOrderNumber('2025021212345678', today)
assert.equal(valid.ok, true)

const tooOld = validateNaverOrderNumber('2025021112345678', today)
assert.equal(tooOld.ok, false)
assert.equal(tooOld.error, NAVER_ORDER_TOO_OLD_MESSAGE)

const badFormat = validateNaverOrderNumber('202502111234567', today)
assert.equal(badFormat.ok, false)
assert.equal(badFormat.error, INVALID_NAVER_ORDER_MESSAGE)

assert.equal(formatOrderHistoryDate('2025021512345678'), '2025-02-15')

console.log('naver order number tests passed')
