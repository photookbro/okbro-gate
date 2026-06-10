import { NextRequest, NextResponse } from 'next/server'

export function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const password = process.env.ADMIN_PASSWORD
  if (!password || !token) return false
  return token === password
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: '관리자 인증이 필요해요' }, { status: 401 })
}
