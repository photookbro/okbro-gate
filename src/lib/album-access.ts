import type { VerificationInfo } from '@/lib/order-verification'

export type AlbumBDownloadAction = 'app-install' | 'open-album' | 'gps-hint' | 'verify-order'

export function hasGpsAlbumAccess(verification: VerificationInfo): boolean {
  return verification.access_source === 'gps' && !!verification.gps_passed_at
}

export function hasPurchaseAlbumAccess(verification: VerificationInfo): boolean {
  return verification.purchase_verified === true
}

export function resolveAlbumBDownloadAction(
  verification: VerificationInfo,
  appInstalled: boolean
): AlbumBDownloadAction {
  if (!appInstalled) return 'app-install'

  if (hasGpsAlbumAccess(verification)) return 'open-album'
  if (!hasPurchaseAlbumAccess(verification)) return 'verify-order'
  if (!hasGpsAlbumAccess(verification)) return 'gps-hint'

  return 'open-album'
}
