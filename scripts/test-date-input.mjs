import assert from 'node:assert/strict'

function digitsOnly(value) {
  return value.replace(/\D/g, '').slice(0, 8)
}

function formatDateDigits(digits) {
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function formatDateInputValue(raw) {
  return formatDateDigits(digitsOnly(raw))
}

function isCompleteIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

assert.equal(formatDateInputValue('20250608'), '2025-06-08')
assert.equal(formatDateInputValue('2025-06-08'), '2025-06-08')
assert.equal(formatDateInputValue('202506'), '2025-06')
assert.equal(formatDateInputValue('2025'), '2025')
assert.equal(formatDateInputValue('202506081'), '2025-06-08')

assert.equal(isCompleteIsoDate('2025-06-08'), true)
assert.equal(isCompleteIsoDate('2025-06-0'), false)
assert.equal(isCompleteIsoDate('2025-13-01'), false)
assert.equal(isCompleteIsoDate('2025-02-30'), false)

console.log('date-input: all cases passed')
