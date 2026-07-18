'use client'

import { FRUIT_STORE_URL } from '@/lib/fruit-store'

export function FixedFruitCta() {
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
          🎁 과일사러 대박과수원으로
        </a>
      </div>
    </div>
  )
}
