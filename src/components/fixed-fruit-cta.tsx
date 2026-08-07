'use client'

import Link from 'next/link'
import { FRUIT_STORE_URL } from '@/lib/fruit-store'

const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/photo_ok_bro/'

export function FixedFruitCta() {
  return (
    <div className="bottom-cta-bar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur">
      <div className="bottom-cta-row mx-auto w-full max-w-[1100px] px-4 py-3">
        <a
          className="bottom-cta-btn"
          href={FRUIT_STORE_URL}
          target="_blank"
          rel="noreferrer"
          data-guest-allowed
        >
          과일사러 가기
        </a>
        <a
          className="bottom-cta-btn"
          href={INSTAGRAM_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          data-guest-allowed
        >
          FOLLOW @photo_ok_bro
        </a>
        <Link href="/mypage" className="bottom-cta-btn">
          주문번호 인증하러 가기
        </Link>
      </div>
    </div>
  )
}
