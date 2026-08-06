import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * 의심 주문의 해당 orders 행을 삭제해 인증을 취소합니다.
 * (유저 전체 expire가 아닌, 해당 주문번호 행만 제거)
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : ''

  if (!orderId) {
    return NextResponse.json({ error: 'order_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('orders')
    .delete()
    .eq('id', orderId)
    .select('id, user_id, order_number')
    .maybeSingle()

  if (error) {
    console.error('[admin/naver-orders/revoke]', error)
    return NextResponse.json({ error: '인증 취소에 실패했어요' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '해당 주문을 찾지 못했어요' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    deleted: data,
  })
}
