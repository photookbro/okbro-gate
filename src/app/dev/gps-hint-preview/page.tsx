import { GpsHintInfographic } from '@/components/gps-hint-infographic'

export default function GpsHintPreviewPage() {
  return (
    <div className="page-shell">
      <div className="page-container-wide max-w-md">
        <p className="mb-4 text-xs text-muted">Dev preview — GPS hint modal</p>
        <div className="modal-card shadow-[var(--shadow-modal)]">
          <h3 className="section-title text-lg">🎬 촬영 시각 알림 안내</h3>

          <div className="gps-hint-copy space-y-3">
            <p>
              당신은 과일인증을 통해 앨범을 열람할 수 있는 동시에 일정기간 동안 접근할 수 있어요!
            </p>
            <p>
              다음 경기에는 앱에 &apos;촬영 감지 ON&apos;을 누르면 내가 촬영할 때의 시각을 자동으로 받을
              수 있어요.
            </p>
            <p>다음 대회에서 사진을 더 쉽게 찾아보세요! 🎬</p>
          </div>

          <GpsHintInfographic />

          <button type="button" className="btn-primary w-full">
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
