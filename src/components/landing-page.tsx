'use client'

import { PwaInstallButton } from '@/components/pwa-install-button'
import { PastEventsSection } from '@/components/past-events-section'
import { UpcomingEventsSection } from '@/components/upcoming-events-section'

export function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero" aria-label="OKbroGATE 소개">
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <p className="landing-hero-kicker">전문 스포츠 사진 · 오켱 카메라 알림</p>
          <div className="landing-hero-copy">
            <p>
              마라톤, 그란폰도, 철인, 트레일 러닝 등 사진 찾기가 어려우셨져?
            </p>
            <p>
              얼굴인식도, 배번인식도 안되었을 때 오켱 카메라 옆을 지나간 시각을 알림
              받으세요.
            </p>
            <p>
              이제는 배번이 가려져도 고글을 써서 얼굴이 안보여도 다 찾을수 있습니다.
            </p>
          </div>
          <PwaInstallButton />
        </div>
      </section>

      <div className="landing-below">
        <div className="page-container-wide landing-events-wrap events-page">
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
