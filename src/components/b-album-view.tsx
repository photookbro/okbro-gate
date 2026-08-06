'use client'

import { formatGpsPassDisplay } from '@/lib/gps-access'
import { formatShootRecordLabel } from '@/lib/shoot-record'

type BAlbumViewProps = {
  albumBUrl: string
  gpsTime: string
}

export function BAlbumView({ albumBUrl, gpsTime }: BAlbumViewProps) {
  function handleOpen() {
    window.open(albumBUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <div className="alert-success">
        <p className="font-semibold">{formatShootRecordLabel(gpsTime)}</p>
        <p className="mt-1 text-sm">📍 GPS 통과 {formatGpsPassDisplay(gpsTime)}</p>
      </div>

      <div className="alert-warning">
        <p className="font-semibold">⚠️ 본인 확인용 링크입니다.</p>
        <p className="mt-1 text-sm">
          무단 공유 시 법적 문제가 발생할 수 있고, 개인정보보호법에 따라 책임을
          물을 수 있습니다.
        </p>
      </div>

      <button type="button" onClick={handleOpen} className="btn-primary w-full">
        앨범 열기
      </button>
    </div>
  )
}
