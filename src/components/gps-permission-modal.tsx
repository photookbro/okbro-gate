'use client'

import type { ReactNode } from 'react'
import { BackgroundGpsNotice } from '@/components/background-gps-notice'
import { GpsPermissionEmphasisNotice } from '@/components/gps-permission-emphasis-notice'
import {
  detectPlatform,
  getGeolocationSettingsGuide,
} from '@/lib/app-permissions'

export type GpsPermissionModalMode = 'request' | 'onboarding' | 'recheck'

type GpsPermissionModalProps = {
  open: boolean
  mode?: GpsPermissionModalMode
  requesting?: boolean
  errorMessage?: string
  showSettingsGuide?: boolean
  onAllow: () => void
  onDismiss?: () => void
  onSkip?: () => void
  footer?: ReactNode
  showEmphasisNotice?: boolean
  showBackgroundNotice?: boolean
}

export function GpsPermissionModal({
  open,
  mode = 'request',
  requesting = false,
  errorMessage,
  showSettingsGuide = false,
  onAllow,
  onDismiss,
  onSkip,
  footer,
  showEmphasisNotice = mode !== 'onboarding',
  showBackgroundNotice = false,
}: GpsPermissionModalProps) {
  if (!open) return null

  const settingsGuide = getGeolocationSettingsGuide(detectPlatform())
  const allowLabel =
    mode === 'onboarding' ? '허용하기' : showSettingsGuide ? '다시 요청' : '사이트에 있는 동안 허용'

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
            📍 위치 권한이 필요해요
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            촬영 지점 통과 시각을 기록하려면 정확한 위치 권한이 필요해요.
          </p>

          {showSettingsGuide ? (
            <>
              <p className="mb-3 text-sm text-muted">
                브라우저에서 위치 권한이 차단되어 있어요. 아래 순서대로 설정을 켜주세요.
              </p>
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--text)]">
                {settingsGuide.steps.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </>
          ) : (
            <div className="gps-permission-choice gps-permission-choice-active">
              <span className="gps-permission-radio" aria-hidden="true" />
              <span className="gps-permission-choice-label">정확한 위치</span>
            </div>
          )}

          {showBackgroundNotice ? (
            <div className="mt-4">
              <BackgroundGpsNotice compact />
            </div>
          ) : null}

          {errorMessage ? (
            <p className="alert-danger mt-4 mb-0 text-sm">{errorMessage}</p>
          ) : null}

          <div className={onSkip ? 'btn-row mt-5' : 'mt-5'}>
            {onSkip ? (
              <button type="button" className="btn-secondary" onClick={onSkip} disabled={requesting}>
                나중에
              </button>
            ) : null}
            <button
              type="button"
              className={`btn-primary ${onSkip ? '' : 'w-full'}`}
              disabled={requesting}
              onClick={handleAllowClick}
            >
              {requesting ? '요청 중...' : allowLabel}
            </button>
          </div>

          {showSettingsGuide && onDismiss ? (
            <button type="button" className="btn-secondary mt-3 w-full" onClick={onDismiss}>
              닫기
            </button>
          ) : null}
        </div>

        {footer ?? (showEmphasisNotice ? <GpsPermissionEmphasisNotice /> : null)}
      </div>
    </div>
  )
}
