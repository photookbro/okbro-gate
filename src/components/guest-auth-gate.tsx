'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveClientUser } from '@/lib/supabase/auth-client'
import {
  LoginRequiredModal,
  buildLoginHref,
} from '@/components/login-required-modal'
import { isGuestAllowedHref } from '@/lib/fruit-store'
import { isGuestClickExemptPath } from '@/lib/guest-routes'

type AuthStatus = 'loading' | 'guest' | 'user'

type GuestAuthContextValue = {
  isLoggedIn: boolean
  authReady: boolean
}

const GuestAuthContext = createContext<GuestAuthContextValue>({
  isLoggedIn: false,
  authReady: false,
})

export function useGuestAuth(): GuestAuthContextValue {
  return useContext(GuestAuthContext)
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="button"]',
  '[role="switch"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
].join(', ')

function findInteractive(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null
  return target.closest(INTERACTIVE_SELECTOR)
}

function isAllowedInteractive(el: Element): boolean {
  if (el.closest('[data-guest-allowed]')) return true

  if (el instanceof HTMLAnchorElement) {
    const href = el.getAttribute('href')
    if (href && isGuestAllowedHref(href)) return true
  }

  return false
}

export function GuestAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function loadAuth() {
      const user = await resolveClientUser(supabase)
      if (cancelled) return
      setAuthStatus(user ? 'user' : 'guest')
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthStatus(session?.user ? 'user' : 'guest')
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const exemptPage = isGuestClickExemptPath(pathname)
  const shouldGate = authStatus === 'guest' && !exemptPage
  const isLoggedIn = authStatus === 'user'
  const loginHref = buildLoginHref(pathname || '/home')

  function blockGuestAction(e: React.SyntheticEvent) {
    if (!shouldGate) return

    const interactive = findInteractive(e.target)
    if (!interactive) return
    if (isAllowedInteractive(interactive)) return

    e.preventDefault()
    e.stopPropagation()
    setLoginOpen(true)
  }

  function handleKeyDownCapture(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    blockGuestAction(e)
  }

  return (
    <GuestAuthContext.Provider
      value={{ isLoggedIn, authReady: authStatus !== 'loading' }}
    >
      <div onClickCapture={blockGuestAction} onKeyDownCapture={handleKeyDownCapture}>
        {children}

        <div data-guest-allowed>
          <LoginRequiredModal
            open={loginOpen}
            message="이 기능을 사용하려면 로그인이 필요해요."
            loginHref={loginHref}
            onDismiss={() => setLoginOpen(false)}
          />
        </div>
      </div>
    </GuestAuthContext.Provider>
  )
}
