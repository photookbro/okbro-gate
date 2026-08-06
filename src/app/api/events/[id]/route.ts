import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchEventById } from '@/lib/event-query'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { MAX_EVENT_LIST_GPS_LOGS } from '@/lib/event-gps-logs'
import { buildPastGpsPassDisplay } from '@/lib/shoot-record'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: '대회 ID가 필요해요' }, { status: 400 })
  }

  const { data, error } = await fetchEventById(id)

  if (error) {
    console.error('[events/[id]]', error.message)
    return NextResponse.json({ error: '대회 정보 조회 실패' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  const gps_logs: { username: string; time: string }[] = []
  const user = await getAuthenticatedUser()

  if (user) {
    const admin = supabaseAdmin()
    const { data: logs } = await admin
      .from('gps_logs')
      .select('passed_at')
      .eq('user_id', user.id)
      .eq('event_id', id)
      .order('passed_at', { ascending: false })
      .limit(MAX_EVENT_LIST_GPS_LOGS)

    const email = user.email ?? '회원'
    for (const log of logs ?? []) {
      if (!log.passed_at) continue
      const display = buildPastGpsPassDisplay(email, log.passed_at)
      if (display) gps_logs.push(display)
    }
  }

  return NextResponse.json({
    event: {
      ...data,
      // A앨범(저화소) 미사용 — 더 이상 클라이언트에 노출하지 않음
      album_a_url: null,
    },
    gps_logs,
  })
}
