'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPassTimeSeconds } from '@/lib/geo'
import {
  getBluetoothPlatformSupport,
  getBluetoothUnsupportedHint,
  type BluetoothPlatformSupport,
} from '@/lib/bluetooth-platform'
import { ensurePushSubscription, showPassNotification } from '@/lib/push-client'

const BEACON_NAME = 'okbro-gate'
const NOTIFICATION_TITLE = '오켱사진링크게이트'

type BluetoothDetectorProps = {
  eventId: string
  eventName: string
  userId: string | null
}

function isBeaconMatch(name: string | undefined): boolean {
  if (!name) return false
  return name.toLowerCase().includes(BEACON_NAME)
}

export function BluetoothDetector({ eventId, eventName, userId }: BluetoothDetectorProps) {
  const scanRef = useRef<BluetoothLEScan | null>(null)
  const loggedTodayRef = useRef(false)
  const handlerRef = useRef<((event: BluetoothAdvertisingEvent) => void) | null>(null)
  const [scanning, setScanning] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [platform, setPlatform] = useState<BluetoothPlatformSupport | null>(null)

  useEffect(() => {
    setPlatform(getBluetoothPlatformSupport())
  }, [])

  const stopScanning = useCallback(() => {
    if (handlerRef.current) {
      navigator.bluetooth?.removeEventListener('advertisementreceived', handlerRef.current)
      handlerRef.current = null
    }
    if (scanRef.current?.active) {
      scanRef.current.stop()
    }
    scanRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => {
    return () => stopScanning()
  }, [stopScanning])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const recordPass = useCallback(
    async (passedAt: Date) => {
      if (loggedTodayRef.current) return

      const timeLabel = formatPassTimeSeconds(passedAt)
      const message = `✅ ${eventName} 촬영자 통과! ${timeLabel}`

      try {
        const res = await fetch('/api/bluetooth-pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, user_id: userId }),
        })
        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error ?? '통과 기록 저장 실패')
          return
        }

        loggedTodayRef.current = true
        const displayMessage = data.message ?? message
        setToast(displayMessage)
        await showPassNotification(NOTIFICATION_TITLE, displayMessage, '/mypage')
      } catch {
        setErrorMsg('통과 기록 저장 중 오류가 발생했어요')
      }
    },
    [eventId, eventName, userId]
  )

  async function startScanning() {
    if (!platform?.supported) return

    if (!userId) {
      setErrorMsg('로그인 후 이용할 수 있어요')
      return
    }

    const bluetooth = navigator.bluetooth
    if (!bluetooth?.requestLEScan) {
      setErrorMsg('이 브라우저는 Bluetooth 스캔을 지원하지 않아요. Chrome Android를 이용해주세요.')
      return
    }

    setErrorMsg('')

    try {
      const pushReady = await ensurePushSubscription()
      if (!pushReady) {
        setErrorMsg('알림 권한 또는 푸시 구독이 필요해요. 브라우저 설정을 확인해주세요.')
        return
      }

      const handler = (event: BluetoothAdvertisingEvent) => {
        const deviceName = event.device?.name ?? event.name
        if (!isBeaconMatch(deviceName)) return
        void recordPass(new Date())
      }

      handlerRef.current = handler
      bluetooth.addEventListener('advertisementreceived', handler)

      const scan = await bluetooth.requestLEScan({
        filters: [{ namePrefix: BEACON_NAME }],
        keepRepeatedDevices: false,
      })

      scanRef.current = scan
      setScanning(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.toLowerCase().includes('user cancelled') || message.toLowerCase().includes('canceled')) {
        setErrorMsg('Bluetooth 권한이 거부됐어요.')
      } else {
        setErrorMsg('Bluetooth 스캔을 시작하지 못했어요.')
      }
      stopScanning()
    }
  }

  return (
    <>
      <div className="card-section">
        <p className="mb-2 text-sm font-semibold text-[var(--text)]">📍 촬영자 근처 도착 알림</p>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          &quot;{BEACON_NAME}&quot; Bluetooth 신호가 감지되면 통과 시각을 기록하고 푸시 알림을 보내요.
        </p>

        {platform && !platform.supported ? (
          <div className="alert-warning mb-0">
            <p className="mb-2 font-semibold">이 기기에서는 지원되지 않습니다</p>
            <p className="text-sm leading-relaxed">{getBluetoothUnsupportedHint(platform.reason)}</p>
          </div>
        ) : (
          <>
            {!scanning ? (
              <button
                type="button"
                onClick={() => void startScanning()}
                className="btn-primary"
                disabled={!platform?.supported}
              >
                📍 촬영자 근처 도착 알림
              </button>
            ) : (
              <button type="button" onClick={stopScanning} className="btn-secondary">
                ⏹ Bluetooth 스캔 중지
              </button>
            )}

            {scanning && (
              <p className="mt-3 text-xs text-success">Bluetooth 신호 감지 중...</p>
            )}
          </>
        )}

        {errorMsg && <p className="mt-3 text-xs text-danger">{errorMsg}</p>}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] w-[360px] max-w-[90vw] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-3.5 text-sm leading-relaxed text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
