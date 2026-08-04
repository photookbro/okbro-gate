import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

/** 관리자가보낸 미읽음 메시지를 읽음 처리 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('chat_messages')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .eq('sender', 'admin')
    .is('read_at', null)

  if (error) {
    console.error('[chat/read]', error)
    return NextResponse.json({ error: '읽음 처리에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
