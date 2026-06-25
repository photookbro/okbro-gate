'use client'

import { usePathname } from 'next/navigation'
import { AppFirstLaunchPermissions } from '@/components/app-first-launch-permissions'
import { FixedFruitCta } from '@/components/fixed-fruit-cta'
import { InappBrowserWarning } from '@/components/inapp-browser-warning'
import { SiteNav } from '@/components/site-nav'

export function PlayerAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')

  if (isAdminRoute) {
    return <>{children}</>
  }

  return (
    <>
      <AppFirstLaunchPermissions />
      <InappBrowserWarning />
      <SiteNav />
      <div className="page-with-bottom-cta">{children}</div>
      <FixedFruitCta />
    </>
  )
}
