import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .select('id, title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[admin/notifications] list failed:', error)
    return NextResponse.json({ error: '공지 목록 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ notifications: data ?? [] })
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const body = await req.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!title) {
    return NextResponse.json({ error: '공지 제목을 입력해주세요' }, { status: 400 })
  }

  if (!content) {
    return NextResponse.json({ error: '공지 내용을 입력해주세요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .insert({ title, content })
    .select('id, title, content, created_at')
    .single()

  if (error) {
    console.error('[admin/notifications] create failed:', error)
    return NextResponse.json({ error: '공지 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ notification: data })
}
