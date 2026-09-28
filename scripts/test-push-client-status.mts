/**
 * 푸시 구독 상태 판별(클라이언트 전용) — 상태별 결과 + 판별 중 네트워크 호출 없음 확인
 * npx tsx scripts/test-push-client-status.mts
 */
import assert from 'node:assert/strict'

type Scenario = {
  name: string
  userAgent: string
  maxTouchPoints?: number
  standalone?: boolean
  permission?: NotificationPermission
  hasNotification?: boolean
  registration?: 'none' | 'subscribed' | 'unsubscribed'
  expected: string
  bannerExpected: 'prompt' | 'ios' | 'hidden'
}

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15'

const scenarios: Scenario[] = [
  { name: '구독 중', userAgent: ANDROID, permission: 'granted', registration: 'subscribed', expected: 'subscribed', bannerExpected: 'hidden' },
  { name: '미구독(권한 미응답)', userAgent: ANDROID, permission: 'default', registration: 'none', expected: 'default', bannerExpected: 'prompt' },
  { name: '거부', userAgent: ANDROID, permission: 'denied', registration: 'none', expected: 'denied', bannerExpected: 'hidden' },
  { name: '허용했지만 구독 없음', userAgent: ANDROID, permission: 'granted', registration: 'unsubscribed', expected: 'granted_unsubscribed', bannerExpected: 'hidden' },
  { name: '허용 + 서비스워커 미등록', userAgent: ANDROID, permission: 'granted', registration: 'none', expected: 'granted_unsubscribed', bannerExpected: 'hidden' },
  { name: 'iPhone Safari 홈 화면 미추가', userAgent: IPHONE, hasNotification: false, expected: 'ios_needs_install', bannerExpected: 'ios' },
  { name: 'iPad Safari(데스크톱 UA) 미추가', userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5, hasNotification: false, expected: 'ios_needs_install', bannerExpected: 'ios' },
  { name: 'iPhone 홈 화면 앱 · 미응답', userAgent: IPHONE, standalone: true, permission: 'default', registration: 'none', expected: 'default', bannerExpected: 'prompt' },
  { name: 'iPhone 홈 화면 앱 · 구독 중', userAgent: IPHONE, standalone: true, permission: 'granted', registration: 'subscribed', expected: 'subscribed', bannerExpected: 'hidden' },
  { name: '알림 미지원 브라우저', userAgent: ANDROID, hasNotification: false, expected: 'unsupported', bannerExpected: 'hidden' },
]

let networkCalls: string[] = []

function install(s: Scenario) {
  networkCalls = []
  const g = globalThis as Record<string, unknown>
  const registration =
    s.registration === 'none' || s.registration === undefined
      ? undefined
      : { pushManager: { getSubscription: async () => (s.registration === 'subscribed' ? { endpoint: 'x' } : null) } }

  const navigatorStub: Record<string, unknown> = {
    userAgent: s.userAgent,
    maxTouchPoints: s.maxTouchPoints ?? 0,
    standalone: s.standalone === true ? true : undefined,
    serviceWorker: {
      getRegistration: async () => registration,
      register: async (url: string) => {
        networkCalls.push(`serviceWorker.register ${url}`)
        return registration
      },
    },
  }
  Object.defineProperty(globalThis, 'navigator', { value: navigatorStub, configurable: true, writable: true })

  const windowStub: Record<string, unknown> = {
    matchMedia: () => ({ matches: s.standalone === true }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true
    },
  }
  if (s.hasNotification !== false) {
    windowStub.Notification = { permission: s.permission ?? 'default' }
    windowStub.PushManager = function PushManager() {}
    g.Notification = windowStub.Notification
  } else {
    delete g.Notification
  }
  g.window = windowStub
  g.fetch = async (url: string) => {
    networkCalls.push(`fetch ${url}`)
    return new Response('{}')
  }

  const session = new Map<string, string>()
  g.sessionStorage = {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
  }
}

const { resolvePushClientStatus } = await import('../src/lib/push-client.ts')
const { isPushNudgeShownThisSession, markPushNudgeShownThisSession } = await import(
  '../src/lib/push-permission.ts'
)

/** push-subscribe-banner 의 진입 판정과 동일 */
async function bannerModeOnEntry(): Promise<'prompt' | 'ios' | 'hidden'> {
  if (isPushNudgeShownThisSession()) return 'hidden'
  const status = await resolvePushClientStatus()
  const mode = status === 'default' ? 'prompt' : status === 'ios_needs_install' ? 'ios' : 'hidden'
  if (mode !== 'hidden') markPushNudgeShownThisSession()
  return mode
}

const rows: Array<Record<string, string>> = []
for (const s of scenarios) {
  install(s)
  const status = await resolvePushClientStatus()
  assert.equal(status, s.expected, s.name)

  const firstEntry = await bannerModeOnEntry()
  assert.equal(firstEntry, s.bannerExpected, `${s.name} — 배너`)
  const secondEntry = await bannerModeOnEntry()
  assert.equal(secondEntry, 'hidden', `${s.name} — 같은 세션 두 번째 진입은 표시 안 함`)

  assert.deepEqual(networkCalls, [], `${s.name} — 판별 중 네트워크 호출 없음`)
  rows.push({ 상태: s.name, 판별: status, 진입배너: firstEntry, 두번째진입: secondEntry, 네트워크: '0' })
}

console.table(rows)
console.log('push client status: ok')
