import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'

/** 선수가 보낸 미읽음 메시지를 관리자 읽음 처리 */
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('chat_messages')
    .update({ read_at: now })
    .eq('user_id', userId)
    .eq('sender', 'user')
    .is('read_at', null)

  if (error) {
    console.error('[admin/chat/read]', error)
    return NextResponse.json({ error: '읽음 처리에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
