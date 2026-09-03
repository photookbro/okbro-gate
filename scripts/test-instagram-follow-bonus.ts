import assert from 'node:assert/strict'
import { normalizeInstagramHandle } from '../src/lib/instagram-handle.ts'
import {
  calculateInstagramBonusExpiresAt,
  isInstagramBonusActive,
  isInstagramBonusGranted,
} from '../src/lib/instagram-follow-bonus.ts'
import { instagramFollowMismatchPushBody } from '../src/lib/instagram-follow-copy.ts'

assert.equal(normalizeInstagramHandle('@Photo_OK'), 'photo_ok')
assert.equal(normalizeInstagramHandle('https://instagram.com/user.name/'), 'user.name')

assert.equal(
  isInstagramBonusGranted({ status: 'pending', manually_unlocked: true }),
  true
)
assert.equal(
  isInstagramBonusGranted({ status: 'pending', manually_unlocked: false }),
  false
)
assert.equal(
  isInstagramBonusGranted({ status: 'approved', manually_unlocked: false }),
  true
)

const now = new Date()
const future = new Date(now.getTime() + 86400000).toISOString()
assert.equal(
  isInstagramBonusActive(
    { status: 'pending', manually_unlocked: false, expires_at: future },
    now
  ),
  false
)
assert.equal(
  isInstagramBonusActive(
    { status: 'pending', manually_unlocked: true, expires_at: future },
    now
  ),
  true
)

assert.equal(
  instagramFollowMismatchPushBody(),
  '인스타그램 팔로우가 확인되지 않았어요. @photo_ok_bro를 팔로우하고 다시 인증해주세요'
)

const expires = calculateInstagramBonusExpiresAt('2026-07-24T10:00:00.000Z', 5)
assert.ok(expires > new Date('2026-07-28T00:00:00.000Z'))
console.log('ok', expires.toISOString())
