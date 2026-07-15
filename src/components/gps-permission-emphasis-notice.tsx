import { BackgroundGpsNotice } from '@/components/background-gps-notice'

export function GpsPermissionEmphasisNotice() {
  return (
    <div className="gps-permission-emphasis">
      <p className="gps-permission-emphasis-title">⚠️ 중요 안내</p>
      <ul className="gps-permission-emphasis-list">
        <li className="gps-permission-emphasis-nowrap">
          ✓ &apos;사이트에 있는 동안 허용&apos; 또는 &apos;허용&apos;을 선택하세요
        </li>
        <li>✓ 레이스 중 앱을 종료하지 마세요</li>
        <li>✓ 화면만 꺼진 것은 괜찮습니다</li>
        <li>✓ RACE 완료 후 OFF 또는 앱을 닫는 것을 추천드립니다</li>
      </ul>
      <BackgroundGpsNotice />
    </div>
  )
}
