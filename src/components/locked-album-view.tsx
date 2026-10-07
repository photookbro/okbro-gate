'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  INSTAGRAM_LATE_MATCH_NOTICE,
  instagramFollowBonusUsedUpNotice,
} from '@/lib/instagram-follow-copy'

type LockedAlbumViewProps = {
  eventId?: string
  /** true면 앨범 URL은 있으나 인증이 필요함. false면 아직 업로드 전 */
  albumReady?: boolean
}

export function LockedAlbumView({ eventId, albumReady = true }: LockedAlbumViewProps) {
  const [bonusDays, setBonusDays] = useState<number | null>(null)
  const [bonusState, setBonusState] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void authFetch('/api/instagram-follow/status')
      .then(async res => {
        const data = await res.json()
        if (cancelled || !res.ok) return
        if (typeof data.bonus_days_setting === 'number') {
          setBonusDays(data.bonus_days_setting)
        }
        if (typeof data.state === 'string') {
          setBonusState(data.state)
        }
      })
      .catch(() => {
        // ignore
      })

    return () => {
      cancelled = true
    }
  }, [])

  const verifyHref = eventId
    ? `/verify-order?eventId=${encodeURIComponent(eventId)}`
    : '/verify-order'

  return (
    <div className="card-section space-y-4">
      <p className="text-sm leading-relaxed text-[var(--text)]">
        인증 없이는 이 대회의 앨범을 열람할 수 없어요
      </p>
      <Link href={verifyHref} className="btn-primary no-underline">
        인증하기
      </Link>
      {bonusState === 'expired' ? (
        <p className="text-xs leading-relaxed text-muted">{instagramFollowBonusUsedUpNotice()}</p>
      ) : bonusDays !== null ? (
        <p className="text-xs leading-relaxed text-muted">
          참고: 인스타그램을 팔로우하면 첫 {bonusDays}일은 인증 없이 이용할 수 있어요 (
          {INSTAGRAM_LATE_MATCH_NOTICE})
        </p>
      ) : null}
      {!albumReady ? (
        <p className="text-sm text-muted">사진이 아직 도착하지 않았습니다. 조금만 기다려 주세요</p>
      ) : null}
    </div>
  )
}
