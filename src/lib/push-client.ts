import { authFetch } from '@/lib/supabase/auth-client'
import { detectMobilePlatform } from '@/lib/push-permission'

/**
 * 서버 조회 없이 브라우저에서만 판별한 푸시 상태.
 * ios_needs_install: iPhone/iPad Safari 탭 — 홈 화면에 추가한 앱에서만 푸시 가능
 */
export type PushClientStatus =
  | 'subscribed'
  | 'default'
  | 'denied'
  | 'granted_unsubscribed'
  | 'ios_needs_install'
  | 'unsupported'

/** 구독 시도 후 같은 화면의 다른 안내(배너·토글)가 상태를 다시 읽도록 알림 */
export const PUSH_STATUS_CHANGED_EVENT = 'okbro:push-status-changed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

/**
 * 현재 브라우저에 활성 푸시 구독이 있는지 (DB가 아닌 PushManager 기준).
 * 확인만 할 때는 서비스워커를 새로 등록하지 않음 — 등록이 없으면 구독도 없음
 */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return false
    const sub = await registration.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

function isIosDevice(): boolean {
  const ua = navigator.userAgent
  if (detectMobilePlatform(ua) === 'ios') return true
  // iPadOS Safari는 데스크톱(Mac) UA로 보고함
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  return window.matchMedia?.('(display-mode: standalone)').matches === true
}

export async function resolvePushClientStatus(): Promise<PushClientStatus> {
  if (typeof window === 'undefined') return 'unsupported'
  if (isIosDevice() && !isStandaloneDisplay()) return 'ios_needs_install'
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return 'unsupported'
  }

  const permission = Notification.permission
  if (permission === 'denied') return 'denied'
  if (permission === 'default') return 'default'
  return (await hasActivePushSubscription()) ? 'subscribed' : 'granted_unsubscribed'
}

function notifyPushStatusChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PUSH_STATUS_CHANGED_EVENT))
}

/**
 * 알림 권한 요청 + 구독 등록. 브라우저 보안 정책상 사용자가 직접 허용해야 하며
 * 관리자가 강제로 켤 수 있는 방법은 없음 — 반드시 사용자 제스처(클릭 등) 안에서 호출할 것.
 */
export async function ensurePushSubscription(): Promise<boolean> {
  try {
    return await subscribeAndSave()
  } finally {
    notifyPushStatusChanged()
  }
}

async function subscribeAndSave(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return false
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return false
  }

  const registration = await registerServiceWorker()
  if (!registration) return false

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) return false

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
  }

  const res = await authFetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      },
    }),
  })

  return res.ok
}
