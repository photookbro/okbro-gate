import assert from 'node:assert/strict'
import { formatPassTimeSeconds } from '../src/lib/geo.ts'

function emailToUsername(email) {
  const trimmed = email.trim()
  if (!trimmed) return '회원'
  const at = trimmed.indexOf('@')
  return at > 0 ? trimmed.slice(0, at) : trimmed
}

function formatPassTimeMinutes(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

assert.equal(emailToUsername('kospilee@gmail.com'), 'kospilee')

const time = formatPassTimeMinutes('2025-06-15T14:32:45+09:00')
assert.match(time, /^14:32$/)
assert.doesNotMatch(formatPassTimeSeconds(new Date('2025-06-15T14:32:45+09:00')), /^14:32$/)

console.log('shoot-record format tests passed')
