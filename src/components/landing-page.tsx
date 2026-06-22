'use client'

import { useEffect, useState } from 'react'
import { LandingGuideContent } from '@/components/landing-guide-content'
import { PastEventsSection } from '@/components/past-events-section'
import { UpcomingEventsSection } from '@/components/upcoming-events-section'
import { usePwaInstall } from '@/hooks/use-pwa-install'
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
  const { canInstall, isInstalled, installing, promptInstall } = usePwaInstall()

  if (isInstalled) {
    return null
  }

  return (
    <div className="landing-guide-cta">
      {canInstall ? (
        <button
          type="button"
          className="landing-install-btn landing-install-btn-block"
          disabled={installing}
          onClick={() => void promptInstall()}
        >
          {installing ? '설치 준비 중...' : '📥 앱 설치하기'}
        </button>
      ) : (
        <p className="landing-install-fallback">
          브라우저 메뉴에서 &apos;홈 화면에 추가&apos;를 선택하면 앱처럼 이용할 수 있어요
        </p>
      )}
    </div>
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

      <div className="landing-events" id="events">
        <div className="page-container-wide landing-events-wrap events-page">
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
