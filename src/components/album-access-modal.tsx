'use client'

import { useEffect, useState } from 'react'
import { formatVerificationDate, type VerificationInfo } from '@/lib/order-verification'
import {
  APP_INSTALL_URL,
  dismissAppInstallBanner,
  isAppInstallBannerDismissed,
} from '@/components/app-install-banner'

type AlbumAccessModalProps = {
  visible: boolean
  onClose: () => void
  verification: VerificationInfo
  albumBUrl: string
}

export function AlbumAccessModal({
  visible,
  onClose,
  verification,
  albumBUrl,
}: AlbumAccessModalProps) {
  const [showAppSection, setShowAppSection] = useState(true)

  useEffect(() => {
    if (visible) {
      setShowAppSection(!isAppInstallBannerDismissed())
    }
  }, [visible])

  if (!visible) return null

  function handleDismissApp() {
    dismissAppInstallBanner()
    setShowAppSection(false)
  }

  function handleOpenAlbum() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
    onClose()
  }

  const isValid = verification.status === 'valid'
  const isExpired = verification.status === 'expired'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          padding: '1.5rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {isValid && verification?.verified_at && verification?.expires_at && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            ✅ 인증 완료 - {verification?.order_number ?? '-'} /{' '}
            {formatVerificationDate(verification.verified_at)} ~{' '}
            {formatVerificationDate(verification.expires_at)}
          </div>
        )}

        {isExpired && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            ⚠️ 인증이 만료됐어요. 새 주문번호로 다시 인증해주세요.
          </div>
        )}

        {showAppSection && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
            }}
          >
            <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
              📸 다음 대회에서 내 사진 찍히는 순간 바로 알림 받고 싶으세요?
              <br />
              앱을 설치하면 대회 현장 통과 시각을 자동으로 알려드려요.
              <br />
              지금 인증으로 6개월간 무료로 사용할 수 있어요!
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a
                href={APP_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                앱 설치하기
              </a>
              <button
                type="button"
                onClick={handleDismissApp}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                나중에
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleOpenAlbum}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          사진 보러가기 →
        </button>
      </div>
    </div>
  )
}
