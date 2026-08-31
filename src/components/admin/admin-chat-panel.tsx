'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { formatChatTime, type ChatMessageDto } from '@/lib/chat'

type Thread = {
  user_id: string
  email: string
  name: string
  last_message: string
  last_sender: string
  last_at: string
  unread_count: number
}

type SearchUser = {
  id: string
  email: string
  name: string
}

type AdminChatPanelProps = {
  token: string
  initialUserId?: string | null
  onInitialUserConsumed?: () => void
}

export function AdminChatPanel({
  token,
  initialUserId = null,
  onInitialUserConsumed,
}: AdminChatPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [messages, setMessages] = useState<ChatMessageDto[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [showConversation, setShowConversation] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const headers = useCallback(
    () => ({ 'x-admin-token': token, 'Content-Type': 'application/json' }),
    [token]
  )

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res = await fetch('/api/admin/chat/threads', {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '목록 로드 실패')
        return
      }
      setThreads((data.threads as Thread[]) ?? [])
      setError('')
    } catch {
      setError('목록 로드 실패')
    } finally {
      setLoadingThreads(false)
    }
  }, [token])

  const openThread = useCallback(
    async (userId: string, name?: string, email?: string) => {
      setShowConversation(true)
      setSelectedUserId(userId)
      if (name) setSelectedName(name)
      if (email !== undefined) setSelectedEmail(email)
      setLoadingMessages(true)
      setError('')
      try {
        const res = await fetch(
          `/api/admin/chat/messages?user_id=${encodeURIComponent(userId)}`,
          { headers: { 'x-admin-token': token } }
        )
        const data = await res.json()
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '메시지 로드 실패')
          return
        }
        setSelectedName(data.name || name || '선수')
        setSelectedEmail(data.email || email || '')
        setMessages((data.messages as ChatMessageDto[]) ?? [])

        await fetch('/api/admin/chat/read', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ user_id: userId }),
        })
        void loadThreads()
      } catch {
        setError('메시지 로드 실패')
      } finally {
        setLoadingMessages(false)
      }
    },
    [headers, loadThreads, token]
  )

  const closeConversation = useCallback(() => {
    setShowConversation(false)
    setSelectedUserId(null)
    setSelectedName('')
    setSelectedEmail('')
    setMessages([])
    setDraft('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (!initialUserId) return
    void openThread(initialUserId)
    onInitialUserConsumed?.()
  }, [initialUserId, onInitialUserConsumed, openThread])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const q = searchQ.trim()
    if (q.length < 1) {
      setSearchResults([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/admin/chat/users?q=${encodeURIComponent(q)}`, {
            headers: { 'x-admin-token': token },
          })
          const data = await res.json()
          if (!cancelled && res.ok) {
            setSearchResults((data.users as SearchUser[]) ?? [])
          }
        } catch {
          // ignore
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQ, token])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!selectedUserId || sending) return

    // IME 조합 중일 수 있어 React state 대신 input DOM 값을 읽음
    const text = (inputRef.current?.value ?? draft).trim()
    if (!text) {
      setError('메시지를 입력해주세요')
      return
    }

    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/chat/messages', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ user_id: selectedUserId, message: text }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '전송 실패')
        return
      }
      setDraft('')
      if (inputRef.current) inputRef.current.value = ''
      if (data.message) {
        setMessages(prev => [...prev, data.message as ChatMessageDto])
      }
      void loadThreads()
    } catch {
      setError('전송 실패')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className={`admin-chat-layout${showConversation ? ' admin-chat-layout-detail' : ''}`}
    >
      <aside className="admin-chat-sidebar">
        <div>
          <label className="label-field" htmlFor="admin-chat-search">
            선수 검색 (새 대화)
          </label>
          <input
            id="admin-chat-search"
            type="search"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="이메일 또는 이름"
            className="input-field"
          />
          {searchResults.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {searchResults.map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="admin-chat-thread-item w-full"
                    onClick={() => {
                      setSearchQ('')
                      setSearchResults([])
                      void openThread(u.id, u.name, u.email)
                    }}
                  >
                    <p className="admin-chat-thread-name">{u.name}</p>
                    <p className="admin-chat-thread-preview">{u.email}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="text-xs font-semibold text-muted">대화 목록</p>
        <div className="admin-chat-thread-list">
          {loadingThreads ? (
            <p className="text-sm text-muted">로딩 중...</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted">아직 대화가 없어요. 위에서 선수를 검색해 시작하세요.</p>
          ) : (
            threads.map(t => (
              <button
                key={t.user_id}
                type="button"
                className={`admin-chat-thread-item ${selectedUserId === t.user_id ? 'admin-chat-thread-item-active' : ''}`}
                onClick={() => void openThread(t.user_id, t.name, t.email)}
              >
                <p className="admin-chat-thread-name">
                  {t.name}
                  {t.unread_count > 0 ? (
                    <span className="ml-1 text-xs text-[var(--primary)]">({t.unread_count})</span>
                  ) : null}
                </p>
                <p className="admin-chat-thread-preview">{t.last_message}</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="admin-chat-main">
        {selectedUserId ? (
          <>
            <div className="admin-chat-main-header">
              <button
                type="button"
                className="admin-chat-back-btn"
                onClick={closeConversation}
              >
                ← 목록
              </button>
              <span className="admin-chat-main-header-text">
                {selectedName}
                {selectedEmail ? (
                  <span className="ml-2 text-sm font-normal text-muted">{selectedEmail}</span>
                ) : null}
              </span>
            </div>
            <div ref={listRef} className="admin-chat-main-list">
              {loadingMessages ? (
                <p className="text-sm text-muted">불러오는 중...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted">첫 메시지를 보내 대화를 시작하세요.</p>
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
            {error ? <p className="alert-danger mx-3 mb-0 text-sm">{error}</p> : null}
            <form onSubmit={handleSend} className="admin-chat-compose">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="메시지 입력"
                maxLength={2000}
                className="input-field flex-1"
                disabled={sending}
                autoComplete="off"
              />
              <button type="submit" className="btn-primary-inline" disabled={sending}>
                {sending ? '전송 중...' : '전송'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-sm text-muted">왼쪽에서 대화를 선택하거나 선수를 검색하세요.</p>
          </div>
        )}
      </section>
    </div>
  )
}
