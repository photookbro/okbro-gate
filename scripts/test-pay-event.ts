/**
 * 페이대회(is_pay_event) 로직 단위 검증
 * Run: npx tsx scripts/test-pay-event.ts
 */
import assert from 'node:assert/strict'
import { hasBAlbumDownloadAccess } from '../src/lib/album-access'
import { resolveEventAlbumBranch } from '../src/lib/event-album-branch'
import { isGpsTrackingEligible } from '../src/lib/gps-tracking-eligibility'
import type { VerificationInfo } from '../src/lib/order-verification'

function v(partial: Partial<VerificationInfo>): VerificationInfo {
  return { status: 'none', ...partial }
}

// --- 앨범 접근: 페이대회 ---
assert.equal(
  hasBAlbumDownloadAccess(
    v({ status: 'valid', access_source: 'pay_event', is_pay_event: true })
  ),
  true,
  'pay_event access_source → album ok'
)
assert.equal(
  hasBAlbumDownloadAccess(v({ status: 'none', purchase_verified: false }), true),
  true,
  'event flag only → album ok'
)
assert.equal(
  hasBAlbumDownloadAccess(v({ status: 'none', purchase_verified: false }), false),
  false,
  'no pay event, no auth → blocked'
)

// --- 앨범 분기 ---
assert.equal(
  resolveEventAlbumBranch(v({ status: 'valid', access_source: 'pay_event', is_pay_event: true })),
  'purchase-modal',
  'pay event → purchase-modal branch'
)
assert.equal(
  resolveEventAlbumBranch(v({ status: 'none' }), true),
  'purchase-modal',
  'event is_pay_event flag → purchase-modal'
)
assert.equal(
  resolveEventAlbumBranch(v({ status: 'none' }), false),
  'locked',
  'normal event no auth → locked'
)

// --- GPS 토글 자격 (유저 전역) ---
assert.equal(isGpsTrackingEligible({ purchaseValid: false, instagramActive: false }), false)
assert.equal(isGpsTrackingEligible({ purchaseValid: true, instagramActive: false }), true)

// --- EVENTS 목록: 대회별 토글 (페이대회 OR 전역) ---
function canToggleGps(event: { is_pay_event: boolean }, globalEligible: boolean): boolean {
  return event.is_pay_event || globalEligible
}
assert.equal(canToggleGps({ is_pay_event: true }, false), true, 'pay event: toggle ok without purchase')
assert.equal(canToggleGps({ is_pay_event: false }, false), false, 'normal event: blocked without purchase')
assert.equal(canToggleGps({ is_pay_event: false }, true), true, 'normal event: ok with purchase')

// --- 이벤트 분리: 같은 유저, 다른 대회 ---
const payEventVerification = v({
  status: 'valid',
  access_source: 'pay_event',
  is_pay_event: true,
  gps_tracking_eligible: true,
})
const noAuthVerification = v({ status: 'none', purchase_verified: false, gps_tracking_eligible: false })

assert.equal(hasBAlbumDownloadAccess(payEventVerification, true), true)
assert.equal(hasBAlbumDownloadAccess(noAuthVerification, false), false)
assert.equal(canToggleGps({ is_pay_event: true }, false), true)
assert.equal(canToggleGps({ is_pay_event: false }, false), false)

console.log('✅ pay-event logic: all cases passed')
