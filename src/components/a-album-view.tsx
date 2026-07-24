'use client'

import Link from 'next/link'

type AAlbumViewProps = {
  albumAUrl: string | null
  incentive?: string
  eventId?: string
}

export function AAlbumView({
  albumAUrl,
  incentive = '이 장면을 고화질로 만나보세요',
  eventId,
}: AAlbumViewProps) {
  return (
    <div className="space-y-4">
      <div className="alert-warning">
        <p className="font-semibold">🎁 {incentive}</p>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--border) 0%, var(--bg-card) 100%)',
          filter: 'blur(1.5px) saturate(0.6)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            transform: 'rotate(-30deg) scale(1.4)',
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.75)',
                whiteSpace: 'nowrap',
              }}
            >
              SAMPLE
            </span>
          ))}
        </div>
      </div>
      <p className="-mt-2 text-center text-xs text-muted">예시: 무료 저화소 앨범 화질</p>

      {albumAUrl ? (
        <a
          href={albumAUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary block w-full text-center no-underline"
        >
          저화소 앨범 보기
        </a>
      ) : (
        <p className="text-sm text-muted">사진이 아직 도착하지 않았습니다. 조금만 기다려 주세요</p>
      )}

      <p className="pt-1 text-center text-sm text-muted">
        만기가 다되었거나 과일구매인증이 경험이 없으시네요
      </p>

      {eventId ? (
        <Link
          href={`/verify-order?eventId=${encodeURIComponent(eventId)}`}
          className="btn-primary block w-full text-center text-base no-underline"
        >
          인증하고 고화질 앨범 보기
        </Link>
      ) : null}
    </div>
  )
}
