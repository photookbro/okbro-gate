export function GpsPermissionEmphasisNotice() {
  return (
    <div className="gps-permission-emphasis">
      <p className="gps-permission-emphasis-title">⚠️ 중요 안내</p>
      <ul className="gps-permission-emphasis-list">
        <li>✓ &apos;사이트에 있는 동안 허용&apos;을 선택하세요</li>
        <li>✓ 레이스 중 앱을 종료하지 마세요</li>
        <li>✓ 화면만 꺼진 것은 괜찮습니다</li>
        <li>✓ 레이스 종료 후에는 앱을 닫아도 됩니다</li>
      </ul>
      <p className="gps-permission-emphasis-warning">주의: 앱을 닫으면 위치 추적이 멈춥니다!</p>
    </div>
  )
}
