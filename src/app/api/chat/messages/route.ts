import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  normalizeChatMessage,
  toChatMessageDto,
  type ChatMessageRow,
} from '@/lib/chat'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('chat_messages')
    .select('id, user_id, sender, message, created_at, read_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[chat/messages] GET', error)
    return NextResponse.json({ error: '메시지를 불러오지 못했어요' }, { status: 500 })
  }

  const messages = ((data as ChatMessageRow[] | null) ?? []).map(row =>
    toChatMessageDto(row, 'user')
  )

  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const message = normalizeChatMessage(body?.message)
  if (!message) {
    return NextResponse.json({ error: '메시지를 입력해주세요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('chat_messages')
    .insert({
      user_id: user.id,
      sender: 'user',
      message,
    })
    .select('id, user_id, sender, message, created_at, read_at')
    .single()

  if (error || !data) {
    console.error('[chat/messages] POST', error)
    return NextResponse.json({ error: '메시지 전송에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({
    message: toChatMessageDto(data as ChatMessageRow, 'user'),
  })
}
