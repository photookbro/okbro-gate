import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
