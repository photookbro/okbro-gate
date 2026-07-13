'use client'

import { useEffect, useState } from 'react'
import { LandingGuideContent } from '@/components/landing-guide-content'
import { HomeNotificationBanner } from '@/components/home-notification-banner'
import { PastEventsSection } from '@/components/past-events-section'
import { UpcomingEventsSection } from '@/components/upcoming-events-section'
import { VerificationExpiryBanner } from '@/components/verification-expiry-banner'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { PwaInstallGuideModal } from '@/components/pwa-install-guide-modal'
import { detectMobilePlatform, type MobilePlatform } from '@/lib/push-permission'
import {
  buildHomeBackgroundPositionCSSValue,
  DEFAULT_HOME_BACKGROUND_IMAGE,
  DEFAULT_HOME_BACKGROUND_POSITION,
  type HomeBackgroundPosition,
} from '@/lib/home-background'

type HomeBackgroundResponse = {
  image_url?: string
  offset_x?: number
  offset_y?: number
  position?: HomeBackgroundPosition
}

function LandingInstallCta() {
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
      <div className="landing-guide-cta">
        <button
          type="button"
          className="landing-install-btn landing-install-btn-block"
          disabled={installing}
          onClick={handleClick}
        >
          {installing ? '설치 준비 중...' : '📥 앱 설치하기'}
        </button>
        <button type="button" className="landing-install-dismiss" onClick={dismiss}>
          나중에
        </button>
      </div>

      <PwaInstallGuideModal open={guideOpen} platform={platform} onClose={() => setGuideOpen(false)} />
    </>
  )
}

export function LandingPage() {
  const [backgroundImage, setBackgroundImage] = useState(DEFAULT_HOME_BACKGROUND_IMAGE)
  const [backgroundPosition, setBackgroundPosition] = useState<HomeBackgroundPosition>(
    DEFAULT_HOME_BACKGROUND_POSITION
  )

  useEffect(() => {
    fetch('/api/home-background')
      .then(async res => {
        const data = (await res.json()) as HomeBackgroundResponse
        if (res.ok && data.image_url) {
          setBackgroundImage(data.image_url)
        }
        if (res.ok) {
          setBackgroundPosition({
            x: Number(data.offset_x ?? data.position?.x ?? 0),
            y: Number(data.offset_y ?? data.position?.y ?? 0),
          })
        }
      })
      .catch(() => {
        // keep default image
      })
  }, [])

  return (
    <div className="landing-page">
      <section
        className="landing-hero"
        aria-label="OKbroGATE 소개"
        style={{
          backgroundImage: `url("${backgroundImage}")`,
          backgroundPosition: buildHomeBackgroundPositionCSSValue(backgroundPosition),
        }}
      >
        <div className="landing-hero-overlay" aria-hidden="true" />

        <div className="landing-hero-content">
          <div className="landing-guide-scroll">
            <LandingGuideContent />
          </div>
          <LandingInstallCta />
        </div>
      </section>

      <VerificationExpiryBanner />
      <HomeNotificationBanner />

      <div className="landing-events" id="events">
        <div className="page-container-wide landing-events-wrap events-page">
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
