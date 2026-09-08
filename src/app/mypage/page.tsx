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
import { ensurePushSubscription, hasActivePushSubscription } from '@/lib/push-client'
import {
  detectMobilePlatform,
  dismissPushSubscribeBanner,
  getNotificationSettingsGuide,
} from '@/lib/push-permission'
import { emitAuthLogout } from '@/lib/gps-tracking-storage'
import { OrderNumberGuide } from '@/components/order-number-guide'
import { MypageAlbumAccessStatus } from '@/components/mypage-album-access-status'
import { MypageChat } from '@/components/mypage-chat'
import { emitChatUnreadCount } from '@/lib/chat-unread-client'
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

  const [pushSupported, setPushSupported] = useState(true)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default')
  const [enablingNotification, setEnablingNotification] = useState(false)
  const [notificationMsg, setNotificationMsg] = useState('')
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

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
    let cancelled = false

    async function refreshPushState() {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        if (!cancelled) {
          setPushSupported(false)
          setPushPermission('unsupported')
          setPushSubscribed(false)
        }
        return
      }
      const permission = Notification.permission
      const subscribed =
        permission === 'granted' ? await hasActivePushSubscription() : false
      if (cancelled) return
      setPushSupported(true)
      setPushPermission(permission)
      setPushSubscribed(subscribed)
    }

    void refreshPushState()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    authFetch('/api/chat/unread-count')
      .then(async res => {
        const data = await res.json()
        if (!cancelled && res.ok) {
          setChatUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0)
        }
      })
      .catch(() => {
        // ignore
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#chat') return
    const el = document.getElementById('chat')
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [loading])

  async function handlePushToggle() {
    if (enablingNotification) return

    if (pushSubscribed) {
      setNotificationMsg(
        '알림을 끄려면 브라우저(또는 기기) 설정에서 이 사이트의 알림을 차단해주세요'
      )
      return
    }

    if (pushPermission === 'denied') {
      const guide = getNotificationSettingsGuide(
        detectMobilePlatform(navigator.userAgent)
      )
      setNotificationMsg(`${guide.title}. ${guide.steps[0]}`)
      return
    }

    setEnablingNotification(true)
    setNotificationMsg('')
    try {
      const ok = await ensurePushSubscription()
      if (typeof Notification !== 'undefined') {
        setPushPermission(Notification.permission)
      }
      if (ok) {
        setPushSubscribed(true)
        setNotificationMsg('알림을 받기 시작했어요')
        dismissPushSubscribeBanner()
      } else {
        setPushSubscribed(false)
        setNotificationMsg('알림을 켜지 못했어요. 브라우저 설정을 확인해주세요')
      }
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

  async function handleWithdraw() {
    if (withdrawing) return

    const confirmed = window.confirm(
      '정말 탈퇴할까요?\n\n구매 인증·촬영 이력·문의 내역이 모두 삭제되며 복구할 수 없어요.'
    )
    if (!confirmed) return

    setWithdrawing(true)
    setWithdrawError('')

    try {
      const res = await authFetch('/api/account/delete', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        setWithdrawError(typeof data.error === 'string' ? data.error : '회원 탈퇴에 실패했어요')
        return
      }

      emitAuthLogout()
      await supabase.auth.signOut()
      router.replace('/login')
    } catch {
      setWithdrawError('회원 탈퇴 중 오류가 발생했어요')
    } finally {
      setWithdrawing(false)
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
          onInstagramFollowBonusChange={setInstagramFollowBonus}
        />

        <div className="card mb-4">
          <h2 className="section-title">주문번호 인증과 만기연장</h2>
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
          <h2 className="section-title">알림 받기</h2>
          {!pushSupported || pushPermission === 'unsupported' ? (
            <p className="text-sm text-muted">이 브라우저는 알림을 지원하지 않아요</p>
          ) : (
            <>
              <div className="mypage-push-toggle-row">
                <p className="mypage-push-toggle-copy">
                  {pushSubscribed
                    ? '대회 소식과 알림을 받고 있어요'
                    : '대회 소식과 알림을 받아보세요'}
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushSubscribed}
                  aria-label="알림 받기"
                  disabled={enablingNotification}
                  onClick={() => void handlePushToggle()}
                  className={`toggle-switch ${pushSubscribed ? 'toggle-switch-on' : ''}`}
                >
                  <span className="toggle-switch-thumb" />
                </button>
              </div>
              {pushPermission === 'denied' && !pushSubscribed ? (
                <p className="mt-3 mb-0 text-sm text-muted">
                  알림이 차단돼 있어요. 브라우저 설정에서 허용으로 바꾼 뒤 다시 켜주세요
                </p>
              ) : null}
              {notificationMsg ? (
                <p className="mt-3 mb-0 text-sm text-muted">{notificationMsg}</p>
              ) : null}
            </>
          )}
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
                              location.passes.length > 1 ? pass.pass_count : undefined
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

        <div id="chat" className="card mb-4 scroll-mt-24">
          <h2 className="section-title flex items-center gap-2">
            1:1 문의
            {chatUnreadCount > 0 ? (
              <span
                className="nav-chat-badge"
                aria-label={`읽지 않은 메시지 ${chatUnreadCount}개`}
              >
                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
              </span>
            ) : null}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            관리자와 직접 대화할 수 있어요. 답장은 이 화면을 다시 열면 확인할 수 있어요.
          </p>
          <MypageChat
            onUnreadChange={count => {
              setChatUnreadCount(count)
              emitChatUnreadCount(count)
            }}
          />
        </div>

        <section className="mypage-withdraw-section">
          <h2 className="section-title">회원 탈퇴</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">
            탈퇴하면 구매 인증, 촬영 이력, 1:1 문의, 알림 설정이 모두 삭제되며 복구할 수
            없어요.
          </p>
          {withdrawError ? <p className="alert-danger mb-3">{withdrawError}</p> : null}
          <button
            type="button"
            onClick={() => void handleWithdraw()}
            disabled={withdrawing}
            className="mypage-withdraw-btn"
          >
            {withdrawing ? '처리 중...' : '회원 탈퇴하기'}
          </button>
        </section>
      </div>
    </div>
  )
}
