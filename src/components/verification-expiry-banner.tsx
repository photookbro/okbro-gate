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

export function VerificationExpiryBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
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
        setVisible(true)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [pathname])

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <section className="verification-expiry-banner" aria-labelledby="expiry-banner-title">
      <div className="verification-expiry-banner-inner">
        <p id="expiry-banner-title" className="verification-expiry-banner-text">
          ⚠️ 인증이 <strong>{daysRemaining}일</strong> 후 만료됩니다. 계속 이어가시겠어요
        </p>
        <div className="verification-expiry-banner-actions">
          <Link href="/verify-order" className="verification-expiry-banner-cta">
            연장하기
          </Link>
          <button type="button" onClick={handleDismiss} className="verification-expiry-banner-dismiss">
            LATER
          </button>
        </div>
      </div>
    </section>
  )
}
