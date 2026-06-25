import type { Metadata, Viewport } from 'next'
import { AdminShell } from './admin-shell'

export const metadata: Metadata = {
  title: '오켱 ADMIN',
  applicationName: '오켱 ADMIN',
  description: 'OKbroGATE 관리자 앱',
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '오켱 ADMIN',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icons/admin-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/admin-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/admin-icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#1E3A5F',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
