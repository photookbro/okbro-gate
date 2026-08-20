import type { VerificationInfo } from '@/lib/order-verification'

/** locked = 미인증 — 앨범 URL 미노출 */
export type EventAlbumBranch = 'b-album' | 'purchase-modal' | 'locked'

export function resolveEventAlbumBranch(
  verification: VerificationInfo,
  eventIsPayEvent = false
): EventAlbumBranch {
  if (verification.gps_passed_at) return 'b-album'
  const isPay =
    eventIsPayEvent ||
    verification.is_pay_event === true ||
    verification.access_source === 'pay_event'
  if (isPay || verification.purchase_verified || verification.instagram_follow_verified) {
    return 'purchase-modal'
  }
  return 'locked'
}
