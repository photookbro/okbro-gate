import { NextResponse } from 'next/server'
import { fetchLatestNotification } from '@/lib/notifications-server'

export async function GET() {
  try {
    const notification = await fetchLatestNotification()
    return NextResponse.json({ notification })
  } catch (error) {
    console.error('[notifications/latest] load failed:', error)
    return NextResponse.json({ error: '공지 조회 실패' }, { status: 500 })
  }
}
