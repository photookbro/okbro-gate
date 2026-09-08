import assert from 'node:assert/strict'
import {
  isBrandOwnInstagramHandle,
  normalizeInstagramHandle,
} from '../src/lib/instagram-handle.ts'
import {
  calculateInstagramBonusExpiresAt,
  isInstagramBonusActive,
  isInstagramBonusGranted,
} from '../src/lib/instagram-follow-bonus.ts'
import {
  instagramFollowMismatchPushBody,
  instagramOwnAccountClaimBlockedMessage,
} from '../src/lib/instagram-follow-copy.ts'

assert.equal(normalizeInstagramHandle('@Photo_OK'), 'photo_ok')
assert.equal(normalizeInstagramHandle('https://instagram.com/user.name/'), 'user.name')

assert.equal(isBrandOwnInstagramHandle('photo_ok_bro'), true)
assert.equal(isBrandOwnInstagramHandle('@Photo_OK_Bro'), true)
assert.equal(isBrandOwnInstagramHandle('  PHOTO_OK_BRO  '), true)
assert.equal(isBrandOwnInstagramHandle('someone_else'), false)
assert.ok(instagramOwnAccountClaimBlockedMessage().includes('오켱 본인 계정'))

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
  '인스타그램 팔로우가 확인되지 않았어요. @photo_ok_bro 팔로우와 아이디 입력을 다시 확인해주세요'
)

const expires = calculateInstagramBonusExpiresAt('2026-07-24T10:00:00.000Z', 5)
assert.ok(expires > new Date('2026-07-28T00:00:00.000Z'))
console.log('ok', expires.toISOString())
