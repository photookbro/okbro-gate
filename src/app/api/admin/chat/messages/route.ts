import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  normalizeChatMessage,
  toChatMessageDto,
  type ChatMessageRow,
} from '@/lib/chat'
import { getUserDisplayName } from '@/lib/admin-players'

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const userId = new URL(req.url).searchParams.get('user_id')?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('chat_messages')
    .select('id, user_id, sender, message, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/chat/messages] GET', error)
    return NextResponse.json({ error: '메시지를 불러오지 못했어요' }, { status: 500 })
  }

  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const athlete = authData?.user

  return NextResponse.json({
    user_id: userId,
    email: athlete?.email ?? '',
    name: athlete ? getUserDisplayName(athlete) : '선수',
    messages: ((data as ChatMessageRow[] | null) ?? []).map(row =>
      toChatMessageDto(row, 'admin')
    ),
  })
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
  const message = normalizeChatMessage(body?.message)

  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: '메시지를 입력해주세요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId)
  if (authError || !authData?.user) {
    return NextResponse.json({ error: '선수를 찾을 수 없어요' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('chat_messages')
    .insert({
      user_id: userId,
      sender: 'admin',
      message,
    })
    .select('id, user_id, sender, message, created_at, read_at')
    .single()

  if (error || !data) {
    console.error('[admin/chat/messages] POST', error)
    return NextResponse.json({ error: '메시지 전송에 실패했어요' }, { status: 500 })
  }

  return NextResponse.json({
    message: toChatMessageDto(data as ChatMessageRow, 'admin'),
  })
}
