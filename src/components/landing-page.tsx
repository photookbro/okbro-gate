'use client'

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
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
