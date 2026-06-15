'use client'

import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import { APP_INSTALL_URL } from '@/components/app-install-banner'

type AlbumAccessModalProps = {
  visible: boolean
  onClose: () => void
  verification: VerificationInfo
  albumBUrl: string
  albumAUrl?: string | null
}

export function AlbumAccessModal({
  visible,
  onClose,
  verification,
  albumBUrl,
  albumAUrl,
}: AlbumAccessModalProps) {
  if (!visible) return null

  function handleOpenAlbumA() {
    if (!albumAUrl) return
    window.open(albumAUrl, '_blank', 'noopener,noreferrer')
  }

  function handleOpenAlbumB() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
    onClose()
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card max-w-[440px]" onClick={e => e.stopPropagation()}>
        {isValid && verification?.verified_at && verification?.expires_at && (
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

        <div className="card-section mb-4">
          <p className="mb-4 text-sm leading-relaxed text-[var(--text)]">
            📸 다음 대회에서 내 사진 찍히는 순간 바로 알림 받고 싶으세요?
            <br />
            앱을 설치하면 대회 현장 통과 시각을 자동으로 알려드려요.
            <br />
            지금 인증으로 6개월간 무료로 사용할 수 있어요!
          </p>
          <a
            href={APP_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-inline block w-full text-center no-underline"
          >
            앱 설치하기
          </a>
        </div>

        <div className="btn-row">
          <button
            type="button"
            onClick={handleOpenAlbumA}
            disabled={!albumAUrl}
            className="btn-secondary"
          >
            📸 사진 보기
          </button>
          <button type="button" onClick={handleOpenAlbumB} className="btn-primary">
            ⬇️ 고화질 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
