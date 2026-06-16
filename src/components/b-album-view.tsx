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
        <p className="font-semibold">⚠️ 이 링크는 공유하지 마세요!</p>
        <p className="mt-1 text-sm">당신의 개인 정보가 포함되어 있어요.</p>
      </div>

      <button type="button" onClick={handleOpen} className="btn-primary w-full">
        B앨범 열기
      </button>
    </div>
  )
}
