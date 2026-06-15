import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getVerificationInfo, type VerificationInfo } from '@/lib/order-verification'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const eventId = new URL(req.url).searchParams.get('event_id')
  const admin = supabaseAdmin()

  const [{ data: order }, { data: settings }] = await Promise.all([
    admin
      .from('orders')
      .select('order_number, used_at, created_at, expires_at')
      .eq('user_id', user.id)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('settings')
      .select('key, value')
      .eq('key', 'verified_period_months'),
  ])

  const verifiedPeriodMonths = Number(
    settings?.find(s => s?.key === 'verified_period_months')?.value ?? NaN
  )

  const purchaseInfo = getVerificationInfo(order ?? null, verifiedPeriodMonths)
  const purchaseVerified = purchaseInfo.status === 'valid'

  if (eventId) {
    const { data: gpsLog } = await admin
      .from('gps_logs')
      .select('passed_at')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .order('passed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (gpsLog?.passed_at) {
      const gpsAccess: VerificationInfo = {
        status: 'valid',
        access_source: 'gps',
        gps_passed_at: gpsLog.passed_at,
        purchase_verified: purchaseVerified,
      }
      return NextResponse.json(gpsAccess)
    }
  }

  if (purchaseInfo.status === 'valid') {
    return NextResponse.json({
      ...purchaseInfo,
      access_source: 'purchase' as const,
      purchase_verified: true,
    })
  }

  return NextResponse.json({
    ...purchaseInfo,
    purchase_verified: false,
  })
}
