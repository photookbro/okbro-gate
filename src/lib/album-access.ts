import type { VerificationInfo } from '@/lib/order-verification'

export type AlbumBDownloadAction = 'open-album' | 'gps-hint' | 'verify-order'

export function hasGpsAlbumAccess(verification: VerificationInfo): boolean {
  return verification.access_source === 'gps' && !!verification.gps_passed_at
}

export function hasPurchaseAlbumAccess(verification: VerificationInfo): boolean {
  return verification.purchase_verified === true
}

/** 고화소 앨범 다운로드 플로우 — 구매 인증 또는 GPS 통과 */
export function hasBAlbumDownloadAccess(verification: VerificationInfo): boolean {
  return hasPurchaseAlbumAccess(verification) || hasGpsAlbumAccess(verification)
}

export function resolveAlbumBDownloadAction(
  verification: VerificationInfo
): AlbumBDownloadAction {
  if (hasGpsAlbumAccess(verification)) return 'open-album'
  if (!hasPurchaseAlbumAccess(verification)) return 'verify-order'
  if (!hasGpsAlbumAccess(verification)) return 'gps-hint'

  return 'open-album'
}
