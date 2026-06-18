'use client'

import { usePwaInstall } from '@/hooks/use-pwa-install'

type PwaInstallButtonProps = {
  className?: string
}

export function PwaInstallButton({ className = 'landing-install-btn' }: PwaInstallButtonProps) {
  const { canInstall, isInstalled, installing, promptInstall } = usePwaInstall()

  if (!canInstall) {
    if (isInstalled) {
      return (
        <p className="landing-install-installed" role="status">
          ✅ 앱이 설치되어 있어요
        </p>
      )
    }
    return null
  }

  return (
    <button
      type="button"
      className={className}
      disabled={installing}
      onClick={() => void promptInstall()}
    >
      {installing ? '설치 준비 중...' : '📥 앱 설치하기'}
    </button>
  )
}
