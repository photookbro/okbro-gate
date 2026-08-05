'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveClientUser } from '@/lib/supabase/auth-client'
import { emitAuthLogout } from '@/lib/gps-tracking-storage'

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
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    // 세션 종료 전에 GPS watch/로컬 CAPTURING을 먼저 끊음
    emitAuthLogout()
    await supabase.auth.signOut()
    setUserId(null)
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
          <Link
            href="/shop"
            className={navLinkClass(pathname === '/shop' || pathname.startsWith('/shop/'))}
            data-guest-allowed
          >
            SHOP
          </Link>
          {userId ? (
            <>
              <Link href="/mypage" className={navLinkClass(pathname === '/mypage')}>
                MY PAGE
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
