'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import { formatGpsPassDisplay } from '@/lib/gps-access'
import { isAppInstalled } from '@/lib/app-install'
import { resolveAlbumBDownloadAction } from '@/lib/album-access'
import { APP_INSTALL_URL } from '@/components/app-install-banner'
import { GpsHintInfographic } from '@/components/gps-hint-infographic'

type AlbumAccessModalProps = {
  visible: boolean
  onClose: () => void
  verification: VerificationInfo
  albumBUrl: string
  albumAUrl?: string | null
  eventId?: string
}

type ModalView = 'main' | 'app-install' | 'gps-hint'

export function AlbumAccessModal({
  visible,
  onClose,
  verification,
  albumBUrl,
  albumAUrl,
  eventId,
}: AlbumAccessModalProps) {
  const router = useRouter()
  const [modalView, setModalView] = useState<ModalView>('main')

  useEffect(() => {
    if (visible) setModalView('main')
  }, [visible])

  if (!visible) return null

  function handleOpenAlbumA() {
    if (!albumAUrl) return
    window.open(albumAUrl, '_blank', 'noopener,noreferrer')
  }

  function handleOpenAlbumB() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
    onClose()
  }

  function goToVerifyOrder() {
    onClose()
    if (eventId) {
      router.push(`/verify-order?eventId=${encodeURIComponent(eventId)}`)
      return
    }
    router.push('/verify-order')
  }

  function runAccessCheck() {
    const action = resolveAlbumBDownloadAction(verification, true)

    if (action === 'open-album') {
      handleOpenAlbumB()
      return
    }
    if (action === 'gps-hint') {
      setModalView('gps-hint')
      return
    }
    goToVerifyOrder()
  }

  function handleDownloadClick() {
    const action = resolveAlbumBDownloadAction(verification, isAppInstalled())

    if (action === 'app-install') {
      setModalView('app-install')
      return
    }
    if (action === 'open-album') {
      handleOpenAlbumB()
      return
    }
    if (action === 'gps-hint') {
      setModalView('gps-hint')
      return
    }
    goToVerifyOrder()
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'
  const isGpsAccess = verification.access_source === 'gps'

  if (modalView === 'app-install') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card max-w-[440px]" onClick={e => e.stopPropagation()}>
          <h3 className="section-title">📱 앱 설치 안내</h3>
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
            className="btn-primary mb-3 block w-full text-center no-underline"
          >
            앱 설치하기
          </a>
          <button type="button" onClick={runAccessCheck} className="btn-secondary w-full">
            웹에서 계속하기
          </button>
        </div>
      </div>
    )
  }

  if (modalView === 'gps-hint') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card max-w-md" onClick={e => e.stopPropagation()}>
          <h3 className="section-title text-lg">🎬 촬영 시각 알림 안내</h3>

          <div className="gps-hint-copy space-y-3">
            <p>
              당신은 과일인증을 통해 앨범을 열람할 수 있는 동시에 일정기간 동안 접근할 수 있어요!
            </p>
            <p>
              다음 경기에는 앱에 &apos;촬영 감지 ON&apos;을 누르면 내가 촬영할 때의 시각을 자동으로 받을
              수 있어요.
            </p>
            <p>다음 대회에서 사진을 더 쉽게 찾아보세요! 🎬</p>
          </div>

          <GpsHintInfographic />

          <button type="button" onClick={handleOpenAlbumB} className="btn-primary w-full">
            확인
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
            📍 GPS 통과: {formatGpsPassDisplay(verification.gps_passed_at)} (B앨범 자동 접근)
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
          <button type="button" onClick={handleDownloadClick} className="btn-primary">
            ⬇️ 고화질 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
