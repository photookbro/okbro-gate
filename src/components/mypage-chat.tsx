'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { authFetch } from '@/lib/supabase/auth-client'
import { formatChatTime, type ChatMessageDto } from '@/lib/chat'

type MypageChatProps = {
  onUnreadChange?: (count: number) => void
}

export function MypageChat({ onUnreadChange }: MypageChatProps) {
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      const res = await authFetch('/api/chat/messages')
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '메시지를 불러오지 못했어요')
        return
      }
      setMessages((data.messages as ChatMessageDto[]) ?? [])
      setError('')
    } catch {
      setError('메시지를 불러오지 못했어요')
    }
  }, [])

  const markRead = useCallback(async () => {
    try {
      await authFetch('/api/chat/read', { method: 'POST' })
      onUnreadChange?.(0)
    } catch {
      // ignore
    }
  }, [onUnreadChange])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      await loadMessages()
      if (!cancelled) {
        setLoading(false)
        await markRead()
        requestAnimationFrame(scrollToBottom)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadMessages, markRead, scrollToBottom])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    // IME 조합 중일 수 있어 React state 대신 input DOM 값을 읽음
    const text = (inputRef.current?.value ?? draft).trim()
    if (!text) {
      setError('메시지를 입력해주세요')
      return
    }
    if (sending) return

    setSending(true)
    setError('')
    try {
      const res = await authFetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '전송에 실패했어요')
        return
      }
      setDraft('')
      if (inputRef.current) inputRef.current.value = ''
      if (data.message) {
        setMessages(prev => [...prev, data.message as ChatMessageDto])
      } else {
        await loadMessages()
      }
    } catch {
      setError('전송에 실패했어요')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mypage-chat">
      <div ref={listRef} className="mypage-chat-list" aria-live="polite">
        {loading ? (
          <p className="text-sm text-muted">불러오는 중...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">
            아직 대화가 없어요. 문의 내용을 입력해 보내주세요.
          </p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`mypage-chat-bubble ${msg.is_mine ? 'mypage-chat-bubble-mine' : 'mypage-chat-bubble-admin'}`}
            >
              <p className="mypage-chat-bubble-text">{msg.message}</p>
              <p className="mypage-chat-bubble-time">{formatChatTime(msg.created_at)}</p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="alert-danger mt-2 mb-0 text-sm">{error}</p> : null}

      <form onSubmit={handleSend} className="mypage-chat-compose">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="메시지를 입력하세요"
          maxLength={2000}
          className="input-field flex-1"
          disabled={sending}
          autoComplete="off"
        />
        <button type="submit" className="btn-primary-inline" disabled={sending}>
          {sending ? '전송 중...' : '전송'}
        </button>
      </form>
    </div>
  )
}
