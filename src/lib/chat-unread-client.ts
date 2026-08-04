export const CHAT_UNREAD_EVENT = 'okbro-chat-unread'

export function emitChatUnreadCount(count: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(CHAT_UNREAD_EVENT, {
      detail: { count: Math.max(0, Math.floor(count)) },
    })
  )
}

export function readChatUnreadFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null
  const count = (event.detail as { count?: unknown } | null)?.count
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : null
}
