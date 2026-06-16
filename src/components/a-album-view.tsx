'use client'

import Link from 'next/link'

const FRUIT_STORE_URL = 'https://smartstore.naver.com/daebakfresh'

export const SAMPLE_ORDER_NUMBERS = ['20250608001', '20250608002', '20250609001'] as const

type AAlbumViewProps = {
  albumAUrl: string | null
  incentive?: string
  eventId?: string
}

export function AAlbumView({
  albumAUrl,
  incentive = '고화질을 보려면 과일 구매!',
  eventId,
}: AAlbumViewProps) {
  return (
    <div className="space-y-4">
      <div className="alert-warning">
        <p className="font-semibold">🎁 {incentive}</p>
      </div>

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
        <p className="text-sm text-muted">저화소 앨범이 아직 준비되지 않았어요.</p>
      )}

      <a
        href={FRUIT_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary block w-full text-center no-underline"
      >
        과일 구매하기
      </a>

      <div className="card-section mb-0 text-center text-sm text-muted">
        <p className="mb-2 font-medium text-[var(--text)]">테스트용 주문번호</p>
        <ul className="mb-2 space-y-1">
          {SAMPLE_ORDER_NUMBERS.map(orderNumber => (
            <li key={orderNumber}>
              {eventId ? (
                <Link
                  href={`/verify-order?eventId=${encodeURIComponent(eventId)}`}
                  className="font-mono font-medium text-[var(--primary)] underline"
                >
                  {orderNumber}
                </Link>
              ) : (
                <span className="font-mono font-medium">{orderNumber}</span>
              )}
            </li>
          ))}
        </ul>
        <p>위 주문번호로 인증하면 테스트 가능합니다</p>
      </div>
    </div>
  )
}
