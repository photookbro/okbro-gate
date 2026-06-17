import type { Metadata } from 'next'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { InappBrowserWarning } from '@/components/inapp-browser-warning'
import { PushRegister } from '@/components/push-register'
import { FixedFruitCta } from '@/components/fixed-fruit-cta'
import { PushPermissionModal } from '@/components/push-permission-modal'
import { VerificationExpiryModal } from '@/components/verification-expiry-modal'

export const metadata: Metadata = {
  title: '오켱사진링크게이트',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>
        <PushRegister />
        <PushPermissionModal />
        <VerificationExpiryModal />
        <InappBrowserWarning />
        <SiteNav />
        <div className="page-with-bottom-cta">{children}</div>
        <FixedFruitCta />
      </body>
    </html>
  )
}
