import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { getVerificationInfo } from '@/lib/order-verification'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  const [{ data: order }, { data: settings }] = await Promise.all([
    admin
      .from('orders')
      .select('order_number, used_at, created_at')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
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
