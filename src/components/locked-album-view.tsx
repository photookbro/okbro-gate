'use client'

import Link from 'next/link'

type LockedAlbumViewProps = {
  eventId?: string
  /** true면 앨범 URL은 있으나 인증이 필요함. false면 아직 업로드 전 */
  albumReady?: boolean
}

export function LockedAlbumView({ eventId, albumReady = true }: LockedAlbumViewProps) {
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
      {!albumReady ? (
        <p className="text-sm text-muted">사진이 아직 도착하지 않았습니다. 조금만 기다려 주세요</p>
      ) : null}
    </div>
  )
}
