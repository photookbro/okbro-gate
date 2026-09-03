import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import { getKstDateParts } from '@/lib/order-verification'

/** KST 기준 어제의 끝 — 오늘로 잡혀 ‘D-1’로 남는 문제 방지 */
function revokedExpiresAtIso(now: Date = new Date()): string {
  const { year, month, day } = getKstDateParts(now)
  return new Date(Date.UTC(year, month - 1, day - 1, 14, 59, 59, 999)).toISOString()
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { user_id } = await req.json()
  if (!user_id?.trim()) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const revokedAt = revokedExpiresAtIso()
  const nowIso = new Date().toISOString()

  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .update({ expires_at: revokedAt })
    .eq('user_id', user_id)
    .select('id')

  if (ordersError) {
    console.error('[admin/players/revoke-access] orders', ordersError.message)
    return NextResponse.json({ error: '열람 강제 만료 실패' }, { status: 500 })
  }

  const { data: bonuses, error: bonusError } = await admin
    .from('instagram_follow_bonus')
    .update({ expires_at: revokedAt, updated_at: nowIso })
    .eq('user_id', user_id)
    .or('status.eq.approved,and(status.eq.pending,manually_unlocked.eq.true)')
    .select('id')

  if (bonusError) {
    console.error('[admin/players/revoke-access] instagram', bonusError.message)
    return NextResponse.json(
      { error: '구매 인증은 만료했지만 인스타 혜택 만료에 실패했어요' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    revoked_count: orders?.length ?? 0,
    instagram_revoked_count: bonuses?.length ?? 0,
  })
}
