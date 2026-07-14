'use client'

export const APP_INSTALL_URL = 'https://okbro-gate.vercel.app'

type AppInstallBannerProps = {
  visible?: boolean
}

export function AppInstallBanner({ visible = true }: AppInstallBannerProps) {
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
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FF5500',
            color: '#ffffff',
            fontSize: '0.9rem',
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          INSTALL
        </a>
      </div>
    </div>
  )
}
