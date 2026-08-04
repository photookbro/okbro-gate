import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { count, error } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('sender', 'admin')
    .is('read_at', null)

  if (error) {
    console.error('[chat/unread-count]', error)
    return NextResponse.json({ error: '미읽음 수를 불러오지 못했어요' }, { status: 500 })
  }

  return NextResponse.json({ unread_count: count ?? 0 })
}
