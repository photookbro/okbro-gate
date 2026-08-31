'use client'

import { useGpsTrackingEnabled } from '@/lib/gps-tracking-storage'

type GpsTrackingBannerProps = {
  eventId: string
}

export function GpsTrackingBanner({ eventId }: GpsTrackingBannerProps) {
  const [enabled] = useGpsTrackingEnabled(eventId)

  if (!enabled) return null

  return (
    <div className="gps-tracking-banner" role="status">
      <div className="gps-tracking-banner-inner">
        <p className="gps-tracking-banner-title">⚠️ GPS와 근거리통신 포착 중</p>
        <p className="gps-tracking-banner-text">
          RACE 완료 후 OFF를 누르는 것을 추천드립니다.
          <br />
          이 앱은 백그라운드 GPS/근거리통신을 지원하지 않아요.
          <br />
          앱을 완전히 종료하면 촬영 로그가 멈춥니다.
          <br />
          화면만 꺼진 상태는 괜찮아요.
          <br />
          가능하면 이 대회 상세 화면을 켠 채로 두세요.
        </p>
      </div>
    </div>
  )
}
