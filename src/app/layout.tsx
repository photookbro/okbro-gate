import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { InappBrowserWarning } from '@/components/inapp-browser-warning'
import { PushRegister } from '@/components/push-register'
import { FixedFruitCta } from '@/components/fixed-fruit-cta'
import { PushPermissionModal } from '@/components/push-permission-modal'
import { VerificationExpiryModal } from '@/components/verification-expiry-modal'

export const metadata: Metadata = {
  title: 'OKbroGATE',
  applicationName: 'OKbroGATE',
  description: '전문 스포츠 사진 포토존 게이트',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'OKbroGATE',
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#FF5500',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF5500" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
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
