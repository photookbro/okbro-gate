import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { USER_GPS_TRACKING_PREFS_TABLE } from '@/lib/user-gps-tracking-prefs-server'
import { sendKakaoNotify } from '@/lib/kakao-notify'

async function notifyGpsTrackingEnabled(
  admin: ReturnType<typeof supabaseAdmin>,
  userEmail: string | undefined,
  eventId: string
) {
  const { data: event } = await admin.from('events').select('name').eq('id', eventId).maybeSingle()
  const eventName = event?.name ?? '알 수 없는 대회'
  await sendKakaoNotify(`[오켱GATE] 대회 참여: ${eventName} - ${userEmail ?? '알 수 없음'}`)
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const eventId = req.nextUrl.searchParams.get('event_id')?.trim()
  if (!eventId) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from(USER_GPS_TRACKING_PREFS_TABLE)
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
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const { event_id, enabled } = await req.json()
  if (!event_id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'event_id, enabled가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: existingPref } = await admin
    .from(USER_GPS_TRACKING_PREFS_TABLE)
    .select('enabled')
    .eq('user_id', user.id)
    .eq('event_id', event_id)
    .maybeSingle()

  const wasEnabled = existingPref?.enabled === true

  const { error } = await admin
    .from(USER_GPS_TRACKING_PREFS_TABLE)
    .upsert(
      {
        user_id: user.id,
        event_id,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,event_id' }
    )

  if (error) {
    console.error('[gps-tracking-pref]', error)
    return NextResponse.json({ error: '설정 저장 실패' }, { status: 500 })
  }

  if (enabled && !wasEnabled) {
    after(() => notifyGpsTrackingEnabled(admin, user.email, event_id))
  }

  return NextResponse.json({ success: true, enabled })
}
