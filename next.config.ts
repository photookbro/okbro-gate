import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js', 'googleapis'],
    // /api/admin 업로드(대회 사진·홈 배경 최대 20MB)가 middleware 기본 10MB에 잘리지 않도록
    middlewareClientMaxBodySize: '25mb',
  },
}

export default nextConfig
