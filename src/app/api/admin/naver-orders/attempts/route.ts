import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

/** 구매 인증 중복 제출 시도 로그 (NAVER ORDERS 모니터링 참고용) */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 50))

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('order_verification_attempts')
    .select(
      'id, user_id, user_email, order_number, platform, outcome, existing_order_id, existing_user_id, created_at'
    )
    .eq('outcome', 'duplicate_rejected')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[admin/naver-orders/attempts] GET', error)
    return NextResponse.json(
      {
        error:
          error.code === 'PGRST205' || error.message?.includes('order_verification_attempts')
            ? 'order_verification_attempts 테이블이 없어요. 마이그레이션 SQL을 실행해주세요.'
            : '중복 시도 로그를 불러오지 못했어요',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ attempts: data ?? [] })
}
