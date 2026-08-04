'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveClientUser } from '@/lib/supabase/auth-client'
import { MypageChat } from '@/components/mypage-chat'
import { emitChatUnreadCount } from '@/lib/chat-unread-client'

export default function ChatPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const user = await resolveClientUser(supabase)
      if (cancelled) return
      if (!user) {
        router.replace('/login?next=/chat')
        return
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  if (!ready) {
    return (
      <div className="page-shell mypage-page flex items-center justify-center">
        <p className="text-muted">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="page-shell mypage-page">
      <div className="page-container">
        <h1 className="page-title">1:1</h1>
        <p className="page-subtitle mb-4">
          관리자와 직접 대화할 수 있어요. 답장은 이 화면을 다시 열면 확인할 수 있어요.
        </p>
        <div className="card mb-4">
          <MypageChat
            onUnreadChange={count => {
              emitChatUnreadCount(count)
            }}
          />
        </div>
      </div>
    </div>
  )
}
