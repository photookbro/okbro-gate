'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/supabase/auth-client'
import {
  CHAT_UNREAD_EVENT,
  readChatUnreadFromEvent,
} from '@/lib/chat-unread-client'

const DISMISS_KEY = 'okbro_chat_unread_prompt_dismissed'
const CHAT_HREF = '/mypage#chat'

function wasDismissedThisSession(): boolean {
  if (typeof window === 'undefined') return true
  return sessionStorage.getItem(DISMISS_KEY) === '1'
}

function markDismissedThisSession() {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(DISMISS_KEY, '1')
}

function isOnMypageChat(pathname: string | null): boolean {
  return pathname === '/mypage' || !!pathname?.startsWith('/mypage/')
}

export function ChatUnreadPrompt() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const maybeOpen = useCallback(
    (count: number) => {
      setUnreadCount(count)
      if (count <= 0) {
        setOpen(false)
        return
      }
      if (wasDismissedThisSession()) return
      // 마이페이지에 이미 있으면 채팅 섹션을 바로 볼 수 있어 팝업 생략
      if (isOnMypageChat(pathname)) return
      setOpen(true)
    },
    [pathname]
  )

  const checkUnread = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat/unread-count')
      const data = await res.json()
      if (!res.ok) return
      const count = typeof data.unread_count === 'number' ? data.unread_count : 0
      maybeOpen(count)
    } catch {
      // ignore
    }
  }, [maybeOpen])

  useEffect(() => {
    void checkUnread()
  }, [checkUnread])

  useEffect(() => {
    function onUnreadEvent(event: Event) {
      const count = readChatUnreadFromEvent(event)
      if (count != null) maybeOpen(count)
    }
    window.addEventListener(CHAT_UNREAD_EVENT, onUnreadEvent)
    return () => window.removeEventListener(CHAT_UNREAD_EVENT, onUnreadEvent)
  }, [maybeOpen])

  useEffect(() => {
    if (isOnMypageChat(pathname)) {
      setOpen(false)
    }
  }, [pathname])

  function handleDismiss() {
    markDismissedThisSession()
    setOpen(false)
  }

  if (!open || unreadCount <= 0) return null

  return (
    <div className="modal-overlay z-[70]" onClick={handleDismiss}>
      <div
        className="modal-card max-w-md"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="chat-unread-prompt-title"
      >
        <h2 id="chat-unread-prompt-title" className="section-title">
          안 읽은 메시지가 있어요
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          관리자에게서 읽지 않은 메시지 {unreadCount}개가 있어요.
          <br />
          마이페이지 1:1 채팅에서 확인해 주세요.
        </p>
        <div className="btn-row">
          <button type="button" className="btn-secondary" onClick={handleDismiss}>
            나중에
          </button>
          <Link href={CHAT_HREF} className="btn-primary no-underline" onClick={handleDismiss}>
            확인하기
          </Link>
        </div>
      </div>
    </div>
  )
}
