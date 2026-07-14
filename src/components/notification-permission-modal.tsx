'use client'

type NotificationPermissionModalProps = {
  open: boolean
  requesting: boolean
  onAllow: () => void
  onSkip: () => void
}

export function NotificationPermissionModal({
  open,
  requesting,
  onAllow,
  onSkip,
}: NotificationPermissionModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay z-[70]" onClick={onSkip}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="notification-permission-title"
      >
        <h2 id="notification-permission-title" className="section-title">
          🔔 촬영 알림을 받으시겠어요?
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          대회 종료 후 사진이 찍힌 시각을 알려드려요. 선택 사항이며, 나중에 마이페이지에서
          켤 수 있어요.
        </p>
        <div className="btn-row">
          <button type="button" className="btn-secondary" onClick={onSkip} disabled={requesting}>
            LATER
          </button>
          <button type="button" className="btn-primary" onClick={onAllow} disabled={requesting}>
            {requesting ? '요청 중...' : '알림 허용'}
          </button>
        </div>
      </div>
    </div>
  )
}
