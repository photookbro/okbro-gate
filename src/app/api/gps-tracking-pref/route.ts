import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ enabled: false })
  }

  const eventId = req.nextUrl.searchParams.get('event_id')?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('gps_tracking_prefs')
    .select('enabled')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle()

  if (error) {
    console.error('[gps-tracking-pref] GET', error)
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ enabled: data?.enabled === true })
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { event_id, enabled } = await req.json()
  if (!event_id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'event_id, enabled가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  if (!enabled) {
    await admin.from('gps_tracking_prefs').delete().eq('user_id', user.id).eq('event_id', event_id)
    return NextResponse.json({ success: true, enabled: false })
  }

  const { error } = await admin.from('gps_tracking_prefs').upsert(
    {
      user_id: user.id,
      event_id,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,event_id' }
  )

  if (error) {
    console.error('[gps-tracking-pref]', error)
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true, enabled: true })
}
