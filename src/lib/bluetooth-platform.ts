import { isInAppBrowser } from '@/lib/in-app-browser'

export type BluetoothUnsupportedReason =
  | 'ios'
  | 'firefox'
  | 'in-app'
  | 'not-android'
  | 'unsupported-browser'

export type BluetoothPlatformSupport =
  | { supported: true }
  | { supported: false; reason: BluetoothUnsupportedReason }

export function getBluetoothPlatformSupport(): BluetoothPlatformSupport {
  if (typeof navigator === 'undefined') {
    return { supported: false, reason: 'not-android' }
  }

  const ua = navigator.userAgent

  if (/iphone|ipad|ipod/i.test(ua)) {
    return { supported: false, reason: 'ios' }
  }

  if (!/android/i.test(ua)) {
    return { supported: false, reason: 'not-android' }
  }

  if (isInAppBrowser()) {
    return { supported: false, reason: 'in-app' }
  }

  if (/Firefox/i.test(ua)) {
    return { supported: false, reason: 'firefox' }
  }

  const isSamsung = /SamsungBrowser/i.test(ua)
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua) && !isSamsung

  if (isSamsung || isChrome) {
    return { supported: true }
  }

  return { supported: false, reason: 'unsupported-browser' }
}

export function getBluetoothUnsupportedHint(reason: BluetoothUnsupportedReason): string {
  switch (reason) {
    case 'ios':
      return 'iPhone: 개발 중 (곧 지원 예정)'
    case 'firefox':
      return 'Android: Chrome 앱에서 직접 접속해주세요.'
    case 'in-app':
      return '카톡 링크: 우측 상단 ... → "Chrome으로 열기"'
    case 'not-android':
    case 'unsupported-browser':
    default:
      return 'Android: Chrome 앱에서 직접 접속해주세요.'
  }
}
