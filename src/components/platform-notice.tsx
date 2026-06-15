'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'platform-notice-dismissed-v1'

export function PlatformNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="modal-overlay z-[60]">
      <div className="modal-card max-w-md">
        <h2 className="section-title mb-4">📱 시각 동기화 알림</h2>

        <div className="mb-4 space-y-3 text-sm leading-relaxed text-[var(--text)]">
          <div>
            <p className="mb-2 font-semibold">다음 브라우저에서 사용 가능합니다:</p>
            <ul className="space-y-1 text-muted">
              <li>✅ Android + Chrome</li>
              <li>✅ Android + Samsung Internet</li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold">다음은 현재 지원되지 않습니다:</p>
            <ul className="space-y-1 text-muted">
              <li>❌ iPhone/iPad (개발 중)</li>
              <li>❌ Android Firefox</li>
              <li>❌ 카카오톡/인스타그램 등 앱 내 브라우저</li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
            <p className="mb-2 font-semibold">[해결 방법]</p>
            <ul className="space-y-1 text-muted">
              <li>- Android: Chrome 앱에서 직접 접속</li>
              <li>- iPhone: 개발 중 (곧 지원 예정)</li>
              <li>- 카톡 링크: 우측 상단 ... → &quot;Chrome으로 열기&quot;</li>
            </ul>
          </div>
        </div>

        <button type="button" onClick={dismiss} className="btn-primary">
          닫기
        </button>
      </div>
    </div>
  )
}
