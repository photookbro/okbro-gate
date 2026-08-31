'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/supabase/auth-client'
import { hasTermsAgreed } from '@/lib/terms-agreement'
import {
  INSTAGRAM_BENEFIT_BANNER_DISMISS_KEY,
  INSTAGRAM_PROFILE_URL,
  instagramFollowBenefitLine,
} from '@/lib/instagram-follow-copy'

export function InstagramFollowBenefitBanner() {
  const [visible, setVisible] = useState(false)
  const [bonusDays, setBonusDays] = useState<number | null>(null)

  useEffect(() => {
    if (!hasTermsAgreed()) return

    try {
      if (localStorage.getItem(INSTAGRAM_BENEFIT_BANNER_DISMISS_KEY) === '1') return
    } catch {
      // ignore
    }

    let cancelled = false

    void authFetch('/api/instagram-follow/status')
      .then(async res => {
        const data = await res.json()
        if (cancelled || !res.ok) return
        if (data.state === 'active') {
          try {
            localStorage.setItem(INSTAGRAM_BENEFIT_BANNER_DISMISS_KEY, '1')
          } catch {
            // ignore
          }
          return
        }
        if (typeof data.bonus_days_setting === 'number') {
          setBonusDays(data.bonus_days_setting)
        }
        setVisible(true)
      })
      .catch(() => {
        // ignore
      })

    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(INSTAGRAM_BENEFIT_BANNER_DISMISS_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible || bonusDays === null) return null

  return (
    <div className="instagram-follow-benefit-banner" role="region" aria-label="인스타 팔로우 혜택 안내">
      <div className="instagram-follow-benefit-banner-inner">
        <p className="instagram-follow-benefit-banner-text">
          {instagramFollowBenefitLine(bonusDays)}
        </p>
        <div className="instagram-follow-benefit-banner-actions">
          <a
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary-inline no-underline"
          >
            인스타 팔로우 ↗
          </a>
          <Link href="/instagram-follow" className="btn-secondary-inline no-underline">
            아이디 등록
          </Link>
          <button type="button" onClick={dismiss} className="btn-secondary-inline">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
