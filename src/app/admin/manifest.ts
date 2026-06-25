import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: '오켱 ADMIN',
    short_name: '오켱 ADMIN',
    description: 'OKbroGATE 관리자 앱',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#1E3A5F',
    icons: [
      {
        src: '/icons/admin-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/admin-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
