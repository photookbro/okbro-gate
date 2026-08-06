'use client'

import Link from 'next/link'

type LockedAlbumViewProps = {
  eventId?: string
  /** true면 앨범 URL은 있으나 인증이 필요함. false면 아직 업로드 전 */
  albumReady?: boolean
}

export function LockedAlbumView({ eventId, albumReady = true }: LockedAlbumViewProps) {
  return (
    <div className="space-y-4">
      <div className="alert-warning">
        <p className="font-semibold">🔒 인증 후 열람 가능</p>
        <p className="mt-1 text-sm">
          구매 인증 · GPS 통과 · 인스타 팔로우 혜택 중 하나가 있으면 앨범을 열 수 있어요.
        </p>
      </div>

      {!albumReady ? (
        <p className="text-sm text-muted">사진이 아직 도착하지 않았습니다. 조금만 기다려 주세요</p>
      ) : null}

      {eventId ? (
        <Link
          href={`/verify-order?eventId=${encodeURIComponent(eventId)}`}
          className="btn-primary block w-full text-center text-base no-underline"
        >
          인증하고 앨범 보기
        </Link>
      ) : null}
    </div>
  )
}
