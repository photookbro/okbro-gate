import { NextRequest, NextResponse } from 'next/server'
import { countDau, computeReturnVisitRate } from '@/lib/activity-metrics-server'
import { listAllAuthUsers } from '@/lib/admin-auth-users'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const admin = supabaseAdmin()

  try {
    const [
      authUsers,
      { count: purchaseCount, error: ordersError },
      { count: instagramCount, error: instagramError },
      dau,
      returnVisit,
    ] = await Promise.all([
      listAllAuthUsers(admin),
      admin.from('orders').select('id', { count: 'exact', head: true }),
      admin
        .from('instagram_follow_bonus')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      countDau(admin),
      computeReturnVisitRate(admin),
    ])

    if (ordersError) {
      return NextResponse.json({ error: '구매 인증 집계 실패' }, { status: 500 })
    }
    if (instagramError) {
      return NextResponse.json({ error: '인스타 인증 집계 실패' }, { status: 500 })
    }

    return NextResponse.json({
      total_signups: authUsers.length,
      purchase_verifications_total: purchaseCount ?? 0,
      instagram_follow_verifications_total: instagramCount ?? 0,
      dau,
      dau_note:
        dau === null
          ? 'last_active_at 컬럼이 없어요. Supabase 마이그레이션(20260820_profiles_last_active_at)을 실행해주세요.'
          : '오늘(KST) last_active_at 기록 유저 수',
      return_visit_rate_percent: returnVisit.rate_percent,
      return_visit_this_week_active: returnVisit.this_week_active,
      return_visit_returning_users: returnVisit.returning_users,
      return_visit_note: returnVisit.note,
      vercel_analytics_url: 'https://vercel.com/dashboard',
    })
  } catch (err) {
    console.error('[admin/dashboard-metrics]', err)
    return NextResponse.json({ error: '지표 조회 실패' }, { status: 500 })
  }
}
