'use client'

import { useEffect, useState } from 'react'
import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import { formatGpsPassDisplay } from '@/lib/gps-access'
import {
  hasBAlbumDownloadAccess,
  hasGpsAlbumAccess,
  hasPurchaseAlbumAccess,
} from '@/lib/album-access'
import { AAlbumView } from '@/components/a-album-view'

type AlbumAccessModalProps = {
  visible: boolean
  onClose: () => void
  verification: VerificationInfo
  albumBUrl: string
  albumAUrl?: string | null
}

type ModalView = 'main' | 'share-warning' | 'a-album-preview'

export function AlbumAccessModal({
  visible,
  onClose,
  verification,
  albumBUrl,
  albumAUrl,
}: AlbumAccessModalProps) {
  const [modalView, setModalView] = useState<ModalView>('main')

  useEffect(() => {
    if (visible) setModalView('main')
  }, [visible])

  if (!visible) return null

  function handleOpenAlbumB() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
    onClose()
  }

  function handleDownloadClick() {
    if (hasBAlbumDownloadAccess(verification)) {
      setModalView('share-warning')
      return
    }
    setModalView('a-album-preview')
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'
  const isGpsAccess = verification.access_source === 'gps'
  const showGpsHint =
    isValid && hasPurchaseAlbumAccess(verification) && !hasGpsAlbumAccess(verification)

  if (modalView === 'share-warning') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card max-w-md" onClick={e => e.stopPropagation()}>
          <div className="alert-warning mb-4">
            <p className="font-semibold">⚠️ 이 링크는 공유하지 마세요!</p>
            <p className="mt-1 text-sm">당신의 개인 정보가 포함되어 있어요.</p>
          </div>
          <button type="button" onClick={handleOpenAlbumB} className="btn-primary w-full">
            고화소 앨범 열기
          </button>
        </div>
      </div>
    )
  }

  if (modalView === 'a-album-preview') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card max-w-lg" onClick={e => e.stopPropagation()}>
          <AAlbumView albumAUrl={albumAUrl ?? null} incentive="이 장면을 고화질로 만나보세요" />
          <button type="button" onClick={onClose} className="btn-secondary mt-4 w-full">
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card max-w-[440px]" onClick={e => e.stopPropagation()}>
        {isValid && isGpsAccess && verification.gps_passed_at && (
          <div className="alert-success mb-4">
            📍 GPS 통과: {formatGpsPassDisplay(verification.gps_passed_at)} (고화소 앨범 자동 접근)
          </div>
        )}

        {isValid && !isGpsAccess && verification?.verified_at && verification?.expires_at && (
          <div className="alert-success mb-4">
            📅 열람 가능 기간 : {formatVerificationDate(verification.verified_at)} ~{' '}
            {formatVerificationDate(verification.expires_at)}
          </div>
        )}

        {isExpired && (
          <div className="alert-warning mb-4">
            ⚠️ 인증이 만료됐어요. 새 주문번호로 다시 인증해주세요.
          </div>
        )}

        {showGpsHint && (
          <div className="card-section mb-4">
            <p className="text-sm leading-relaxed text-[var(--text)]">
              📍 다음 대회에서는 <strong>대회 목록</strong>에서 촬영 감지를 ON으로 설정하면,
              오켱 카메라 앞을 지나갈 때 촬영 시각을 확인할 수 있어요.
            </p>
          </div>
        )}

        <button type="button" onClick={handleDownloadClick} className="btn-primary w-full">
          ⬇️ 고화질 다운로드
        </button>
      </div>
    </div>
  )
}
