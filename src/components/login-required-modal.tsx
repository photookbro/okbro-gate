'use client'

import Link from 'next/link'

type LoginRequiredModalProps = {
  open: boolean
  message?: string
  loginHref: string
  onDismiss: () => void
}

export function LoginRequiredModal({
  open,
  message = '이 기능을 사용하려면 로그인이 필요해요.',
  loginHref,
  onDismiss,
}: LoginRequiredModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay z-[70]" onClick={onDismiss}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="login-required-title"
      >
        <h2 id="login-required-title" className="section-title">
          로그인이 필요해요
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">{message}</p>
        <div className="btn-row">
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            닫기
          </button>
          <Link href={loginHref} className="btn-primary no-underline" onClick={onDismiss}>
            로그인하기
          </Link>
        </div>
      </div>
    </div>
  )
}

export function buildLoginHref(returnPath: string): string {
  const next = returnPath.startsWith('/') ? returnPath : `/${returnPath}`
  return `/login?next=${encodeURIComponent(next)}`
}
