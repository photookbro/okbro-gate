'use client'

import { usePwaInstall } from '@/hooks/use-pwa-install'

type PwaInstallButtonProps = {
  className?: string
}

export function PwaInstallButton({ className = 'landing-install-btn' }: PwaInstallButtonProps) {
  const { canInstall, installing, promptInstall } = usePwaInstall()

  if (!canInstall) {
    return null
  }

  return (
    <button
      type="button"
      className={className}
      disabled={installing}
      onClick={() => void promptInstall()}
    >
      {installing ? '설치 준비 중...' : '📥 INSTALL'}
    </button>
  )
}
