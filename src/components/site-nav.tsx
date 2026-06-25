'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    let cancelled = false

    async function loadAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

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
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await supabase.auth.signOut()
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
          <Link
            href="/#events"
            className={navLinkClass(
              pathname === '/' || pathname === '/events' || pathname.startsWith('/events/')
            )}
          >
            대회 목록
          </Link>
          {userId ? (
            <>
              <Link href="/mypage" className={navLinkClass(pathname === '/mypage')}>
                마이페이지
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="nav-btn-logout"
              >
                {loggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </>
          ) : (
            <Link href="/login" className={navLinkClass(pathname === '/login')}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
