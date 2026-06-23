const DISMISS_UNTIL_KEY = 'okbro_notification_dismiss_until'
const SESSION_CLOSED_KEY = 'okbro_notification_session_closed_id'

type DismissRecord = {
  id: string
  until: number
}

function readDismissRecord(): DismissRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DISMISS_UNTIL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DismissRecord
    if (!parsed?.id || typeof parsed.until !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function isNotificationDismissedToday(notificationId: string): boolean {
  const record = readDismissRecord()
  if (!record) return false
  if (record.id !== notificationId) return false
  if (Date.now() >= record.until) {
    try {
      localStorage.removeItem(DISMISS_UNTIL_KEY)
    } catch {
      // ignore
    }
    return false
  }
  return true
}

export function dismissNotificationToday(notificationId: string) {
  if (typeof window === 'undefined') return
  try {
    const until = Date.now() + 24 * 60 * 60 * 1000
    const record: DismissRecord = { id: notificationId, until }
    localStorage.setItem(DISMISS_UNTIL_KEY, JSON.stringify(record))
  } catch {
    // ignore
  }
}

export function isNotificationClosedForSession(notificationId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SESSION_CLOSED_KEY) === notificationId
  } catch {
    return false
  }
}

export function closeNotificationForSession(notificationId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_CLOSED_KEY, notificationId)
  } catch {
    // ignore
  }
}

export function shouldShowNotificationBanner(notificationId: string): boolean {
  if (isNotificationDismissedToday(notificationId)) return false
  if (isNotificationClosedForSession(notificationId)) return false
  return true
}
