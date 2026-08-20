import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { PlayerAppChrome } from '@/components/player-app-chrome'

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
  themeColor: '#0d0d0d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body>
        <PlayerAppChrome>{children}</PlayerAppChrome>
        <Analytics />
      </body>
    </html>
  )
}
