import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { getUserDisplayName } from '@/lib/admin-players'
import type { ChatMessageRow } from '@/lib/chat'

type ThreadAgg = {
  user_id: string
  last_message: string
  last_sender: string
  last_at: string
  unread_count: number
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('chat_messages')
    .select('id, user_id, sender, message, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    console.error('[admin/chat/threads]', error)
    return NextResponse.json({ error: '채팅 목록을 불러오지 못했어요' }, { status: 500 })
  }

  const rows = (data as ChatMessageRow[] | null) ?? []
  const byUser = new Map<string, ThreadAgg>()

  for (const row of rows) {
    const existing = byUser.get(row.user_id)
    if (!existing) {
      byUser.set(row.user_id, {
        user_id: row.user_id,
        last_message: row.message,
        last_sender: row.sender,
        last_at: row.created_at,
        unread_count: row.sender === 'user' && !row.read_at ? 1 : 0,
      })
      continue
    }
    if (row.sender === 'user' && !row.read_at) {
      existing.unread_count += 1
    }
  }

  const userIds = [...byUser.keys()]
  const emailById = new Map<string, string>()
  const nameById = new Map<string, string>()

  if (userIds.length > 0) {
    // Auth users for display (small N of chat threads)
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: authPage, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (authError || !authPage.users.length) break
      for (const u of authPage.users) {
        if (!byUser.has(u.id)) continue
        emailById.set(u.id, u.email ?? '')
        nameById.set(u.id, getUserDisplayName(u))
      }
      if (authPage.users.length < perPage) break
      page += 1
    }
  }

  const threads = [...byUser.values()]
    .map(t => ({
      user_id: t.user_id,
      email: emailById.get(t.user_id) ?? '',
      name: nameById.get(t.user_id) ?? '선수',
      last_message: t.last_message,
      last_sender: t.last_sender,
      last_at: t.last_at,
      unread_count: t.unread_count,
    }))
    .sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1
      if (a.unread_count === 0 && b.unread_count > 0) return 1
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    })

  return NextResponse.json({ threads })
}
