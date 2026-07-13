import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { user_id } = await req.json()
  if (!user_id?.trim()) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const revokedAt = new Date(Date.now() - 60_000).toISOString()

  const { data, error } = await admin
    .from('orders')
    .update({ expires_at: revokedAt })
    .eq('user_id', user_id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: '열람 강제 만료 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true, revoked_count: data?.length ?? 0 })
}
