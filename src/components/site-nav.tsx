'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authFetch, resolveClientUser } from '@/lib/supabase/auth-client'
import { emitAuthLogout } from '@/lib/gps-tracking-storage'
import {
  CHAT_UNREAD_EVENT,
  readChatUnreadFromEvent,
} from '@/lib/chat-unread-client'

function navLinkClass(active: boolean) {
  return active ? 'nav-link nav-link-active' : 'nav-link'
}

export function SiteNav() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)

  const loadChatUnread = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat/unread-count')
      const data = await res.json()
      if (res.ok && typeof data.unread_count === 'number') {
        setChatUnread(data.unread_count)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadAuth() {
      const user = await resolveClientUser(supabase)

      if (cancelled) return
      setUserId(user?.id ?? null)
      setChecked(true)
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setChecked(true)
      if (!session?.user) setChatUnread(0)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  useEffect(() => {
    if (!userId) {
      setChatUnread(0)
      return
    }

    void loadChatUnread()

    const onUnreadEvent = (event: Event) => {
      const count = readChatUnreadFromEvent(event)
      if (count != null) setChatUnread(count)
    }
    window.addEventListener(CHAT_UNREAD_EVENT, onUnreadEvent)

    const timer = window.setInterval(() => {
      void loadChatUnread()
    }, 30000)

    return () => {
      window.removeEventListener(CHAT_UNREAD_EVENT, onUnreadEvent)
      window.clearInterval(timer)
    }
  }, [userId, loadChatUnread, pathname])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    // 세션 종료 전에 GPS watch/로컬 CAPTURING을 먼저 끊음
    emitAuthLogout()
    await supabase.auth.signOut()
    setUserId(null)
    setChatUnread(0)
    router.push('/login')
  }

  if (!checked) return null

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-accent">OKbro</span>GATE
        </Link>
        <div className="nav-links">
          <Link href="/home" className={navLinkClass(pathname === '/home' || pathname === '/')}>
            HOME
          </Link>
          <Link
            href="/events"
            className={navLinkClass(pathname === '/events' || pathname.startsWith('/events/'))}
          >
            EVENTS
          </Link>
          {userId ? (
            <>
              <Link href="/mypage" className={navLinkClass(pathname === '/mypage')}>
                MY PAGE
              </Link>
              <Link href="/chat" className={navLinkClass(pathname === '/chat' || pathname.startsWith('/chat/'))}>
                <span className="nav-chat-label">
                  1:1
                  {chatUnread > 0 ? (
                    <span className="nav-chat-badge" aria-label={`읽지 않은 메시지 ${chatUnread}개`}>
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  ) : null}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="nav-btn-logout"
              >
                {loggingOut ? '로그아웃 중...' : 'LOG OUT'}
              </button>
            </>
          ) : (
            <Link href="/login" className={navLinkClass(pathname === '/login')}>
              LOG IN
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
