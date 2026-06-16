import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'

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
