export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof (event as BeforeInstallPromptEvent).prompt === 'function'
}

export const PWA_INSTALL_DISMISSED_KEY = 'okbro_pwa_install_dismissed'

export function isPwaInstallDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === '1'
  } catch {
    return true
  }
}

export function dismissPwaInstall(): void {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, '1')
  } catch {
    // ignore
  }
}
