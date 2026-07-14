'use client'

import type { MobilePlatform } from '@/lib/push-permission'

type PwaInstallGuideModalProps = {
  open: boolean
  platform: MobilePlatform
  onClose: () => void
}

export function PwaInstallGuideModal({ open, platform, onClose }: PwaInstallGuideModalProps) {
  if (!open) return null

  const steps =
    platform === 'ios'
      ? [
          '하단(또는 상단) 공유 버튼을 눌러주세요',
          '"홈 화면에 추가"를 선택해주세요',
          '오른쪽 위 "추가"를 눌러 완료해주세요',
        ]
      : [
          '브라우저 메뉴(⋮)를 열어주세요',
          '"홈 화면에 추가" 또는 "앱 설치"를 선택해주세요',
        ]

  return (
    <div className="modal-overlay z-[70]" onClick={onClose}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pwa-install-guide-title"
      >
        <h2 id="pwa-install-guide-title" className="section-title">
          📥 INSTALL
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          아래 순서대로 홈 화면에 추가하면 앱처럼 이용할 수 있어요.
        </p>

        {platform === 'ios' && (
          <p className="mb-4 text-center text-3xl" aria-hidden="true">
            📤 → ➕ → 🏠
          </p>
        )}

        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--text)]">
          {steps.map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <button type="button" className="btn-primary w-full" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  )
}
