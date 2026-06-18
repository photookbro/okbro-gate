'use client'

import { PastEventsSection } from '@/components/past-events-section'
import { UpcomingEventsSection } from '@/components/upcoming-events-section'

export default function EventsPage() {
  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="events-page">
          <UpcomingEventsSection />
          <PastEventsSection />
        </div>
      </div>
    </div>
  )
}
