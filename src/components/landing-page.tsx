'use client'

import Link from 'next/link'
import { HomeNotificationBanner } from '@/components/home-notification-banner'
import { PastEventsSection } from '@/components/past-events-section'
import { UpcomingEventsSection } from '@/components/upcoming-events-section'
import { VerificationExpiryBanner } from '@/components/verification-expiry-banner'

export function LandingPage() {
  return (
    <div className="landing-page">
      <VerificationExpiryBanner />
      <HomeNotificationBanner />

      <div className="landing-events">
        <div className="page-container-wide landing-events-wrap events-page">
          <p className="events-past-mypage-note">
            오켱 카메라에 앞으로 지나간 기록은{' '}
            <Link href="/mypage" className="events-past-mypage-note-link">
              MY PAGE
            </Link>
          </p>
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
