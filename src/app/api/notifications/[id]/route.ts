import { NextRequest, NextResponse } from 'next/server'
import { fetchNotificationById } from '@/lib/notifications-server'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  if (!id?.trim()) {
    return NextResponse.json({ error: '공지 ID가 필요해요' }, { status: 400 })
  }

  try {
    const notification = await fetchNotificationById(id.trim())
    if (!notification) {
      return NextResponse.json({ error: '공지를 찾을 수 없어요' }, { status: 404 })
    }
    return NextResponse.json({ notification })
  } catch (error) {
    console.error('[notifications/[id]] load failed:', error)
    return NextResponse.json({ error: '공지 조회 실패' }, { status: 500 })
  }
}
