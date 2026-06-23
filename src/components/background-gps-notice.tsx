import { BACKGROUND_GPS_UNSUPPORTED_MESSAGE } from '@/lib/app-permissions'

type BackgroundGpsNoticeProps = {
  compact?: boolean
}

export function BackgroundGpsNotice({ compact = false }: BackgroundGpsNoticeProps) {
  return (
    <div className={compact ? 'alert-warning text-sm' : 'gps-permission-emphasis'}>
      {!compact ? <p className="gps-permission-emphasis-title">⚠️ 백그라운드 GPS 안내</p> : null}
      <p className={compact ? 'mb-0 leading-relaxed' : 'gps-permission-emphasis-warning mb-0'}>
        {BACKGROUND_GPS_UNSUPPORTED_MESSAGE}
      </p>
    </div>
  )
}
