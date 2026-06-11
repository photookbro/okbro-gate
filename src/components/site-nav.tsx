'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SiteNav() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!checked) return null

  return (
    <nav
      style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        padding: '0.75rem 1rem',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <Link
          href="/events"
          style={{ color: '#111827', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}
        >
          🏅 오켱GATE
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/events" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>
            대회 목록
          </Link>
          {userId && (
            <>
              <Link href="/mypage" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                마이페이지
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#6b7280',
                  fontSize: '0.85rem',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  opacity: loggingOut ? 0.6 : 1,
                }}
              >
                {loggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </>
          )}
          {!userId && (
            <Link href="/login" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
