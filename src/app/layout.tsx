import type { Metadata } from 'next'
import './globals.css'
import { SiteNav } from '@/components/site-nav'
import { InappBrowserWarning } from '@/components/inapp-browser-warning'

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
        <InappBrowserWarning />
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
