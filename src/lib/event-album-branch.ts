import type { VerificationInfo } from '@/lib/order-verification'

/** locked = 미인증 — 앨범 URL 미노출 */
export type EventAlbumBranch = 'b-album' | 'purchase-modal' | 'locked'

export function resolveEventAlbumBranch(verification: VerificationInfo): EventAlbumBranch {
  if (verification.gps_passed_at) return 'b-album'
  if (verification.purchase_verified || verification.instagram_follow_verified) {
    return 'purchase-modal'
  }
  return 'locked'
}
