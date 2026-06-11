import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { getVerificationInfo } from '@/lib/order-verification'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

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

  return NextResponse.json(getVerificationInfo(order ?? null, verifiedPeriodMonths))
}
