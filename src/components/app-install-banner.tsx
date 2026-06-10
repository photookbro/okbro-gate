'use client'

const DISMISS_KEY = 'app_install_banner_dismissed'

export function isAppInstallBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(DISMISS_KEY) === '1'
}

export function dismissAppInstallBanner(): void {
  sessionStorage.setItem(DISMISS_KEY, '1')
}

type AppInstallBannerProps = {
  visible: boolean
  onDismiss: () => void
}

export function AppInstallBanner({ visible, onDismiss }: AppInstallBannerProps) {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          padding: '1.25rem',
        }}
      >
        <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
          📸 다음 대회에서 내 사진 찍히는 순간, 바로 알림 받고 싶으세요? 앱을 설치하면 대회 현장
          통과 시각을 자동으로 알려드려요. 지금 인증으로 6개월간 무료로 사용할 수 있어요!
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            앱 설치하기
          </button>
          <button
            type="button"
            onClick={onDismiss}
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
    </div>
  )
}
