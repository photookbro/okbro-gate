'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const DISMISS_KEY = 'okbro_expiry_warning_dismissed'

type ExpiryStatus = {
  status: string
  days_remaining?: number
  show_expiry_warning?: boolean
}

export function VerificationExpiryModal() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [daysRemaining, setDaysRemaining] = useState(0)

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return
    if (pathname === '/verify-order') return
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') return

    let cancelled = false

    fetch('/api/verify-order/status')
      .then(async res => {
        if (res.status === 401 || cancelled) return
        const data = (await res.json()) as ExpiryStatus
        if (cancelled || !data.show_expiry_warning) return
        setDaysRemaining(data.days_remaining ?? 0)
        setOpen(true)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [pathname])

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="expiry-modal-title">
      <div className="modal-card max-w-sm">
        <h2 id="expiry-modal-title" className="section-title mb-3 text-base">
          ⚠️ 구매 인증이 {daysRemaining}일 후 만료됩니다. 연장하시겠어요?
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/verify-order"
            className="btn-primary-inline flex-1 text-center no-underline"
            onClick={() => setOpen(false)}
          >
            연장하기
          </Link>
          <button type="button" onClick={handleDismiss} className="btn-secondary-inline flex-1">
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
