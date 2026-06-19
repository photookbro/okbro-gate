'use client'

import type { ReactNode } from 'react'

type GpsPermissionModalProps = {
  open: boolean
  requesting?: boolean
  errorMessage?: string
  onAllow: () => void
  onDismiss?: () => void
  footer?: ReactNode
}

export function GpsPermissionModal({
  open,
  requesting = false,
  errorMessage,
  onAllow,
  onDismiss,
  footer,
}: GpsPermissionModalProps) {
  if (!open) return null

  function handleAllowClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    onAllow()
  }

  return (
    <div className="modal-overlay z-[70]" onClick={onDismiss}>
      <div
        className="gps-permission-stack"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="gps-permission-title"
      >
        <div className="modal-card max-w-md">
          <h2 id="gps-permission-title" className="section-title">
            위치 권한이 필요해요
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            촬영 지점 통과 시각을 기록하려면 정확한 위치가 필요해요.
          </p>

          <div className="gps-permission-choice gps-permission-choice-active">
            <span className="gps-permission-radio" aria-hidden="true" />
            <span className="gps-permission-choice-label">정확한 위치</span>
          </div>

          {errorMessage ? (
            <p className="alert-danger mt-4 mb-0 text-sm">{errorMessage}</p>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={requesting}
            onClick={handleAllowClick}
          >
            {requesting ? '요청 중...' : '사이트에 있는 동안 허용'}
          </button>
        </div>

        {footer}
      </div>
    </div>
  )
}
