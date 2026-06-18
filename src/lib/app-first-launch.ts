export const APP_FIRST_LAUNCH_KEY = 'okbro_app_first_launch_done'

export function isFirstAppLaunchPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(APP_FIRST_LAUNCH_KEY) !== '1'
  } catch {
    return false
  }
}

export function markFirstAppLaunchDone(): void {
  try {
    localStorage.setItem(APP_FIRST_LAUNCH_KEY, '1')
  } catch {
    // ignore
  }
}
