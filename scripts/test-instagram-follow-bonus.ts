import assert from 'node:assert/strict'
import { normalizeInstagramHandle } from '../src/lib/instagram-handle.ts'
import { calculateInstagramBonusExpiresAt } from '../src/lib/instagram-follow-bonus.ts'

assert.equal(normalizeInstagramHandle('@Photo_OK'), 'photo_ok')
assert.equal(normalizeInstagramHandle('https://instagram.com/user.name/'), 'user.name')

const expires = calculateInstagramBonusExpiresAt('2026-07-24T10:00:00.000Z', 5)
assert.ok(expires > new Date('2026-07-28T00:00:00.000Z'))
console.log('ok', expires.toISOString())
