'use client'

import { useEffect, useState } from 'react'
import {
  PUSH_STATUS_CHANGED_EVENT,
  resolvePushClientStatus,
  type PushClientStatus,
} from '@/lib/push-client'

/** 브라우저 권한·PushManager만 읽음 (서버 호출·폴링 없음). null = 아직 판별 전 */
export function usePushClientStatus(): PushClientStatus | null {
  const [status, setStatus] = useState<PushClientStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const update = () => {
      void resolvePushClientStatus().then(next => {
        if (!cancelled) setStatus(next)
      })
    }
    update()
    window.addEventListener(PUSH_STATUS_CHANGED_EVENT, update)
    return () => {
      cancelled = true
      window.removeEventListener(PUSH_STATUS_CHANGED_EVENT, update)
    }
  }, [])

  return status
}
