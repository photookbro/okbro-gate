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
  const [menuOpen, setMenuOpen] = useState(false)

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

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setMenuOpen(false)
    // 세션 종료 전에 GPS watch/로컬 CAPTURING을 먼저 끊음
    emitAuthLogout()
    await supabase.auth.signOut()
    setUserId(null)
    router.push('/login')
  }

  if (!checked) return null

  const links = (
    <>
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
        href="/styleup"
        className={navLinkClass(pathname === '/styleup' || pathname.startsWith('/styleup/'))}
        data-guest-allowed
      >
        styleUP
      </Link>
      <Link
        href="/shop"
        className={navLinkClass(pathname === '/shop' || pathname.startsWith('/shop/'))}
        data-guest-allowed
      >
        SHOP
      </Link>
      <Link
        href="/diagnosis"
        className={navLinkClass(pathname === '/diagnosis' || pathname.startsWith('/diagnosis/'))}
        data-guest-allowed
      >
        CHECK
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
    </>
  )

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="nav-brand">
          <span className="nav-brand-accent">OKbro</span>GATE
        </Link>

        <button
          type="button"
          className="nav-hamburger"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
          aria-controls="site-nav-menu"
          onClick={() => setMenuOpen(open => !open)}
        >
          <span className="nav-hamburger-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div id="site-nav-menu" className={`nav-links${menuOpen ? ' nav-links-open' : ''}`}>
          {links}
        </div>
      </div>
    </nav>
  )
}
