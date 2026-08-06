import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { findSuspectNaverOrders } from '@/lib/naver-orders-reconcile'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** 형식 검증으로 통과한 주문 vs 업로드된 실주문 대조 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const admin = supabaseAdmin()
    const { forgery, duplicate } = await findSuspectNaverOrders(admin)

    return NextResponse.json({
      success: true,
      forgery_count: forgery.length,
      duplicate_count: duplicate.length,
      forgery,
      duplicate,
      summary: `위조 의심 ${forgery.length.toLocaleString('ko-KR')}건 · 중복 사용 ${duplicate.length.toLocaleString('ko-KR')}건`,
    })
  } catch (error) {
    console.error('[admin/naver-orders/reconcile]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '대조 실패' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const admin = supabaseAdmin()
    const { forgery, duplicate } = await findSuspectNaverOrders(admin)

    return NextResponse.json({
      forgery,
      duplicate,
      forgery_count: forgery.length,
      duplicate_count: duplicate.length,
    })
  } catch (error) {
    console.error('[admin/naver-orders/suspects]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '의심 계정 조회 실패' },
      { status: 500 }
    )
  }
}
