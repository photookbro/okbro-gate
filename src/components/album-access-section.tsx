'use client'

import { useState } from 'react'
import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import { formatGpsPassDisplay } from '@/lib/gps-access'
import {
  hasBAlbumDownloadAccess,
  hasGpsAlbumAccess,
  hasPurchaseAlbumAccess,
} from '@/lib/album-access'

type AlbumAccessSectionProps = {
  verification: VerificationInfo
  albumBUrl: string
  eventId?: string
}

type SectionView = 'main' | 'share-warning'

export function AlbumAccessSection({
  verification,
  albumBUrl,
}: AlbumAccessSectionProps) {
  const [view, setView] = useState<SectionView>('main')

  function handleOpenAlbumB() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
  }

  function handleDownloadClick() {
    if (hasBAlbumDownloadAccess(verification)) {
      setView('share-warning')
    }
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'
  const isGpsAccess = verification.access_source === 'gps'
  const canOpenAlbum = hasBAlbumDownloadAccess(verification)
  const showGpsHint =
    isValid && hasPurchaseAlbumAccess(verification) && !hasGpsAlbumAccess(verification)

  if (!canOpenAlbum) {
    return null
  }

  if (view === 'share-warning') {
    return (
      <div className="card-section space-y-4">
        <div className="alert-warning mb-0">
          <p className="font-semibold">⚠️ 본인 확인용 링크입니다.</p>
          <p className="mt-1 text-sm">
            무단 공유 시 법적 문제가 발생할 수 있고, 개인정보보호법에 따라 책임을
            물을 수 있습니다.
          </p>
        </div>
        <button type="button" onClick={handleOpenAlbumB} className="btn-primary w-full">
          앨범 열기
        </button>
        <button type="button" onClick={() => setView('main')} className="btn-secondary w-full">
          돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="card-section space-y-4">
      {isValid && isGpsAccess && verification.gps_passed_at && (
        <div className="alert-success mb-0">
          📍 GPS 통과: {formatGpsPassDisplay(verification.gps_passed_at)} (앨범 자동 접근)
        </div>
      )}

      {isValid && !isGpsAccess && verification?.verified_at && verification?.expires_at && (
        <div className="alert-success mb-0">
          📅 열람 가능 기간 : {formatVerificationDate(verification.verified_at)} ~{' '}
          {formatVerificationDate(verification.expires_at)}
        </div>
      )}

      {isExpired && (
        <div className="alert-warning mb-0">
          ⚠️ 인증이 만료됐어요. 새 주문번호로 다시 인증해주세요.
        </div>
      )}

      {showGpsHint && (
        <p className="text-sm leading-relaxed text-[var(--text)]">
          📍 다음 대회에서는 <strong>대회 목록</strong>에서 촬영 감지를 ON으로 설정하면, 오켱
          카메라 앞을 지나갈 때 촬영 시각을 확인할 수 있어요.
        </p>
      )}

      <button type="button" onClick={handleDownloadClick} className="btn-primary w-full">
        ⬇️ 앨범 열기
      </button>
    </div>
  )
}
