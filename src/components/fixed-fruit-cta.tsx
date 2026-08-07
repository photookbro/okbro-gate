'use client'

import { usePathname } from 'next/navigation'
import { FRUIT_STORE_URL } from '@/lib/fruit-store'

export function FixedFruitCta() {
  const pathname = usePathname()
  if (pathname === '/diagnosis' || pathname?.startsWith('/diagnosis/')) {
    return null
  }

  return (
    <div className="bottom-cta-bar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-3">
        <a
          className="bottom-cta-btn"
          href={FRUIT_STORE_URL}
          target="_blank"
          rel="noreferrer"
          data-guest-allowed
        >
          대박과수원에서 인증하기
        </a>
      </div>
    </div>
  )
}
