import assert from 'node:assert/strict'

function getKstDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return {
    year: Number(parts.find(p => p.type === 'year').value),
    month: Number(parts.find(p => p.type === 'month').value),
    day: Number(parts.find(p => p.type === 'day').value),
  }
}

function endOfKstCalendarDay(date) {
  const { year, month, day } = getKstDateParts(date)
  return new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999))
}

function inclusiveKstPeriodEndsAt(start, days) {
  const { year, month, day } = getKstDateParts(start)
  return new Date(Date.UTC(year, month - 1, day + days - 1, 14, 59, 59, 999))
}

function isExpiryActive(expiresAt, now = new Date()) {
  return now.getTime() <= endOfKstCalendarDay(expiresAt).getTime()
}

function isGpsTrackingEligible({ purchaseValid, instagramActive }) {
  return purchaseValid || instagramActive
}

// 4일 기준 3일 혜택 → 6일 자정까지
const start = new Date(Date.UTC(2026, 7, 3, 15, 0, 0)) // Aug 4 00:00 KST
const ends = inclusiveKstPeriodEndsAt(start, 3)
const parts = getKstDateParts(ends)
assert.equal(parts.year, 2026)
assert.equal(parts.month, 8)
assert.equal(parts.day, 6)

const stillOk = new Date(Date.UTC(2026, 7, 6, 14, 59, 59, 999)) // Aug 6 23:59:59.999 KST
assert.equal(isExpiryActive(ends, stillOk), true)
const expired = new Date(Date.UTC(2026, 7, 6, 15, 0, 0, 0)) // Aug 7 00:00 KST
assert.equal(isExpiryActive(ends, expired), false)

assert.equal(isGpsTrackingEligible({ purchaseValid: true, instagramActive: false }), true)
assert.equal(isGpsTrackingEligible({ purchaseValid: false, instagramActive: true }), true)
assert.equal(isGpsTrackingEligible({ purchaseValid: false, instagramActive: false }), false)

console.log('expiry eod + gps tracking eligible: ok')
