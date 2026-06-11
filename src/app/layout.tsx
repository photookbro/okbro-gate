import type { Metadata } from 'next'
import './globals.css'
import { SiteNav } from '@/components/site-nav'

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
        <SiteNav />
        {children}
      </body>
    </html>
  )
}
