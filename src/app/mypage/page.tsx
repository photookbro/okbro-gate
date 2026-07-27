'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authFetch, resolveClientUser } from '@/lib/supabase/auth-client'
import { NAVER_ORDER_PLACEHOLDER } from '@/lib/naver-order-number'
import { getGpsLocationLabel } from '@/lib/gps-locations'
import {
  formatEventDateDisplay,
  formatOkcamPassSentence,
  GPS_SHOOT_RECORD_DISCLAIMER,
} from '@/lib/events-list-client'
import { ensurePushSubscription } from '@/lib/push-client'
import { OrderNumberGuide } from '@/components/order-number-guide'
import { MypageAlbumAccessStatus } from '@/components/mypage-album-access-status'
import type { InstagramFollowBonusStatus } from '@/lib/instagram-follow-bonus'

type PhotoAccess = {
  purchase_days_remaining: number
  photo_access_days_remaining: number
  purchase_validity_label: string
  status: 'valid' | 'expired' | 'none'
  expiring_soon: boolean
}

type GpsPassEntry = {
  pass_count: number
  display_time: string
  passed_at: string
}

type GpsLocationGroup = {
  location_number: number
  passes: GpsPassEntry[]
}

type GpsEventPasses = {
  event_id: string
  event_name: string
  event_date: string | null
  is_loop_course: boolean
  locations: GpsLocationGroup[]
}

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [photoAccess, setPhotoAccess] = useState<PhotoAccess | null>(null)
  const [gpsEventPasses, setGpsEventPasses] = useState<GpsEventPasses[]>([])
  const [instagramFollowBonus, setInstagramFollowBonus] =
    useState<InstagramFollowBonusStatus | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const [orderInput, setOrderInput] = useState('')
  const [extending, setExtending] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [extendSuccess, setExtendSuccess] = useState('')

  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default')
  const [enablingNotification, setEnablingNotification] = useState(false)
  const [notificationMsg, setNotificationMsg] = useState('')

  const loadMypage = useCallback(async () => {
    try {
      const res = await authFetch('/api/mypage')
      const text = await res.text()
      let data: {
        error?: string
        email?: string
        photo_access?: PhotoAccess | null
        gps_event_passes?: GpsEventPasses[]
        instagram_follow_bonus?: InstagramFollowBonusStatus | null
      } = {}

      if (text.trim()) {
        try {
          data = JSON.parse(text) as typeof data
        } catch {
          setErrorMsg(
            res.ok
              ? '응답을 해석하지 못했어요'
              : `정보를 불러오지 못했어요 (${res.status})`
          )
          return false
        }
      } else if (!res.ok) {
        setErrorMsg(`정보를 불러오지 못했어요 (${res.status})`)
        return false
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? '정보를 불러오지 못했어요')
        return false
      }

      setEmail(data.email ?? '')
      setPhotoAccess(data.photo_access ?? null)
      setGpsEventPasses(data.gps_event_passes ?? [])
      setInstagramFollowBonus(data.instagram_follow_bonus ?? null)
      setErrorMsg('')
      return true
    } catch {
      setErrorMsg('정보를 불러오지 못했어요')
      return false
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }
    setNotificationPermission(Notification.permission)
  }, [])

  async function handleEnableNotification() {
    setEnablingNotification(true)
    setNotificationMsg('')
    try {
      const ok = await ensurePushSubscription()
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission)
      }
      setNotificationMsg(
        ok ? '✅ 촬영 알림이 켜졌어요' : '알림을 켜지 못했어요. 브라우저 설정을 확인해주세요'
      )
    } finally {
      setEnablingNotification(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const user = await resolveClientUser(supabase)

      if (cancelled) return

      if (!user) {
        router.replace('/login?next=/mypage')
        return
      }

      const ok = await loadMypage()
      if (cancelled) return

      if (!ok) {
        const refreshedUser = await resolveClientUser(supabase)
        if (!cancelled && refreshedUser) {
          await loadMypage()
        }
      }

      setLoading(false)
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login?next=/mypage')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router, loadMypage, supabase.auth])

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault()
    setExtendError('')
    setExtendSuccess('')

    if (!orderInput.trim()) {
      setExtendError('주문번호를 입력해주세요')
      return
    }

    setExtending(true)

    try {
      const res = await fetch('/api/verify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: orderInput.trim(),
          platform: 'naver',
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setExtendError(data.error ?? '인증 실패')
        setExtending(false)
        return
      }

      if (data.already_verified) {
        setExtendError('이미 사용한 주문번호예요. 다른 주문번호를 입력해주세요')
        setExtending(false)
        return
      }

      setExtendSuccess('✅ 인증이 완료됐어요!')
      setOrderInput('')
      await loadMypage()
    } catch {
      setExtendError('요청 중 오류가 발생했어요')
    } finally {
      setExtending(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell mypage-page flex items-center justify-center">
        <p className="text-muted">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="page-shell mypage-page">
      <div className="page-container">
        <h1 className="page-title">MY PAGE</h1>
        {email && <p className="page-subtitle">{email}</p>}

        {errorMsg && <p className="alert-danger">{errorMsg}</p>}

        <MypageAlbumAccessStatus
          photoAccess={photoAccess}
          instagramFollowBonus={instagramFollowBonus}
        />

        <div className="card mb-4">
          <h2 className="section-title">인증 연장</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            추가 주문번호로 인증하면 만료일이 연장돼요
          </p>

          <OrderNumberGuide className="mb-3" />

          <form onSubmit={handleExtend}>
            <div className="extend-form-row">
              <div className="flex-1">
                <label htmlFor="extend-order-input" className="label-field">
                  주문번호
                </label>
                <input
                  id="extend-order-input"
                  type="text"
                  value={orderInput}
                  onChange={e => setOrderInput(e.target.value)}
                  placeholder={NAVER_ORDER_PLACEHOLDER}
                  autoComplete="off"
                  className={`input-field ${extendError ? 'input-field-error' : ''}`}
                />
              </div>
              <button type="submit" disabled={extending} className="btn-primary-inline">
                {extending ? '인증 중...' : '인증 연장하기'}
              </button>
            </div>

            {extendError && <p className="alert-danger mt-3 mb-0">{extendError}</p>}
            {extendSuccess && <p className="alert-success mt-3 mb-0">{extendSuccess}</p>}
          </form>
        </div>

        <div className="card mb-4">
          <h2 className="section-title">🔔 촬영 알림</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            촬영 알림을 ON으로 해두셔야 대회 종료 후 알람을 받을 수 있어요
          </p>

          {notificationPermission === 'unsupported' ? (
            <p className="text-sm text-muted">이 브라우저는 알림을 지원하지 않아요</p>
          ) : notificationPermission === 'granted' ? (
            <p className="text-sm text-success">✅ 촬영 알림이 켜져 있어요</p>
          ) : notificationPermission === 'denied' ? (
            <p className="text-sm text-muted">
              알림이 차단돼 있어요. 브라우저 설정에서 알림을 허용으로 바꿔주세요
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnableNotification()}
              disabled={enablingNotification}
              className="btn-primary-inline"
            >
              {enablingNotification ? '요청 중...' : '🔔 촬영 알림 켜기'}
            </button>
          )}

          {notificationMsg && <p className="mt-3 text-sm text-muted">{notificationMsg}</p>}
        </div>

        <div className="card mb-4">
          <h2 className="section-title">📍 촬영 감지 이력</h2>

          {gpsEventPasses.length === 0 ? (
            <p className="text-sm text-muted">아직 촬영 감지 기록이 없어요</p>
          ) : (
            <div className="space-y-4">
              {gpsEventPasses.map(event => (
                <div key={event.event_id}>
                  <p className="mypage-pass-event-heading">
                    <span className="mypage-pass-event-name">{event.event_name}</span>
                    {event.event_date ? (
                      <span className="mypage-pass-event-date">
                        {formatEventDateDisplay(event.event_date)}
                      </span>
                    ) : null}
                  </p>
                  <div className="space-y-1 text-sm text-muted">
                    {event.locations.map(location => (
                      <div key={location.location_number}>
                        {event.locations.length > 1 && (
                          <p className="text-xs font-medium text-[var(--text)]">
                            {getGpsLocationLabel(location.location_number, event.locations.length)}
                          </p>
                        )}
                        {location.passes.map(pass => (
                          <p key={pass.pass_count}>
                            {formatOkcamPassSentence(
                              pass.display_time,
                              event.is_loop_course ? pass.pass_count : undefined
                            )}
                          </p>
                        ))}
                      </div>
                    ))}
                    <p className="mypage-pass-disclaimer">{GPS_SHOOT_RECORD_DISCLAIMER}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
