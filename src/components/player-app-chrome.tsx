'use client'

import { usePathname } from 'next/navigation'
import { AppFirstLaunchPermissions } from '@/components/app-first-launch-permissions'
import { FixedFruitCta } from '@/components/fixed-fruit-cta'
import { GuestAuthGate, useGuestAuth } from '@/components/guest-auth-gate'
import { InappBrowserWarning } from '@/components/inapp-browser-warning'
import { SiteNav } from '@/components/site-nav'

function PlayerChromeBody({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, authReady } = useGuestAuth()

  return (
    <>
      {authReady && isLoggedIn ? <AppFirstLaunchPermissions /> : null}
      <InappBrowserWarning />
      <SiteNav />
      <div className="page-with-bottom-cta">{children}</div>
      <FixedFruitCta />
    </>
  )
}

export function PlayerAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')

  if (isAdminRoute) {
    return <>{children}</>
  }

  return (
    <GuestAuthGate>
      <PlayerChromeBody>{children}</PlayerChromeBody>
    </GuestAuthGate>
  )
}
