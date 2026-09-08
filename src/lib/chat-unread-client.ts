import { authFetch } from '@/lib/supabase/auth-client'

export const CHAT_UNREAD_EVENT = 'okbro-chat-unread'

const UNREAD_CACHE_KEY = 'okbro_chat_unread_cache_v1'
/** 미읽음은 짧게 — 새 답장 반영 지연을 줄이면서 중복 호출 완화 */
const UNREAD_CACHE_TTL_MS = 30_000

type UnreadCache = {
  count: number
  checkedAt: number
}

let memoryUnreadCache: UnreadCache | null = null

function readUnreadCache(): UnreadCache | null {
  if (memoryUnreadCache && Date.now() - memoryUnreadCache.checkedAt <= UNREAD_CACHE_TTL_MS) {
    return memoryUnreadCache
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(UNREAD_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UnreadCache
    if (typeof parsed?.count !== 'number' || typeof parsed?.checkedAt !== 'number') return null
    if (Date.now() - parsed.checkedAt > UNREAD_CACHE_TTL_MS) return null
    memoryUnreadCache = parsed
    return parsed
  } catch {
    return null
  }
}

function writeUnreadCache(count: number): void {
  const payload: UnreadCache = {
    count: Math.max(0, Math.floor(count)),
    checkedAt: Date.now(),
  }
  memoryUnreadCache = payload
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(UNREAD_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

export function clearChatUnreadCache(): void {
  memoryUnreadCache = null
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(UNREAD_CACHE_KEY)
  } catch {
    // ignore
  }
}

export function emitChatUnreadCount(count: number) {
  const next = Math.max(0, Math.floor(count))
  writeUnreadCache(next)
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(CHAT_UNREAD_EVENT, {
      detail: { count: next },
    })
  )
}

export function readChatUnreadFromEvent(event: Event): number | null {
  if (!(event instanceof CustomEvent)) return null
  const count = (event.detail as { count?: unknown } | null)?.count
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : null
}

/** 짧은 캐시를 쓰는 미읽음 조회. force=true면 서버 재조회 */
export async function fetchChatUnreadCount(options?: {
  force?: boolean
}): Promise<number | null> {
  if (!options?.force) {
    const cached = readUnreadCache()
    if (cached) return cached.count
  }

  try {
    const res = await authFetch('/api/chat/unread-count')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const count = typeof data.unread_count === 'number' ? data.unread_count : 0
    writeUnreadCache(count)
    return count
  } catch {
    return null
  }
}
