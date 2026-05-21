import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '오켱사진링크게이트',
  description: '마라톤·그란폰도 대회 사진 — 과일 구매 인증 후 원본 다운로드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
