'use client'

import { useEffect, useState } from 'react'
import { LandingGuideContent } from '@/components/landing-guide-content'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { PwaInstallGuideModal } from '@/components/pwa-install-guide-modal'
import { detectMobilePlatform, type MobilePlatform } from '@/lib/push-permission'

function HomeInstallCta() {
  const { canInstall, isInstalled, installing, promptInstall, dismissed, dismiss } = usePwaInstall()
  const [guideOpen, setGuideOpen] = useState(false)
  const [platform, setPlatform] = useState<MobilePlatform>('other')

  useEffect(() => {
    setPlatform(detectMobilePlatform(navigator.userAgent))
  }, [])

  if (isInstalled || dismissed) {
    return null
  }

  function handleClick() {
    if (canInstall) {
      void promptInstall()
      return
    }
    setGuideOpen(true)
  }

  return (
    <>
      <div className="home-intro-install">
        <button
          type="button"
          className="landing-install-btn landing-install-btn-block"
          disabled={installing}
          onClick={handleClick}
        >
          {installing ? '설치 준비 중...' : '📥 INSTALL'}
        </button>
        <button type="button" className="landing-install-dismiss" onClick={dismiss}>
          LATER
        </button>
      </div>

      <PwaInstallGuideModal open={guideOpen} platform={platform} onClose={() => setGuideOpen(false)} />
    </>
  )
}

export function HomeIntroPage() {
  return (
    <div className="home-intro-page">
      <LandingGuideContent />
      <HomeInstallCta />
    </div>
  )
}
