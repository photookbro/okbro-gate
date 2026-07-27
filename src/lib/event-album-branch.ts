import type { VerificationInfo } from '@/lib/order-verification'

export type EventAlbumBranch = 'b-album' | 'purchase-modal' | 'a-album'

export function resolveEventAlbumBranch(verification: VerificationInfo): EventAlbumBranch {
  if (verification.gps_passed_at) return 'b-album'
  if (verification.purchase_verified || verification.instagram_follow_verified) {
    return 'purchase-modal'
  }
  return 'a-album'
}
