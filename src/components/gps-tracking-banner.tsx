'use client'

import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'
import { BackgroundGpsNotice } from '@/components/background-gps-notice'

type GpsTrackingBannerProps = {
  eventId: string
}

export function GpsTrackingBanner({ eventId }: GpsTrackingBannerProps) {
  const [enabled] = useGpsTrackingEnabled(eventId)

  if (!enabled) return null

  return (
    <div className="gps-tracking-banner" role="status">
      <p className="gps-tracking-banner-title">⚠️ GPS 추적 중</p>
      <p className="gps-tracking-banner-text">
        레이스 완료 후 OFF를 눌러 종료하세요.
        <br />
        주의: 앱이 종료되면 위치 기록이 멈춥니다.
        <br />
        화면이 꺼져도 괜찮습니다.
      </p>
      <div className="mt-2 px-3">
        <BackgroundGpsNotice compact />
      </div>
    </div>
  )
}
