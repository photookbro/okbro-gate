import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { photo_id, order_number, platform, user_id } = await req.json()

  if (!photo_id || !order_number || !platform || !user_id) {
    return NextResponse.json({ error: '필수 값이 없어요' }, { status: 400 })
  }

  if (order_number.length < 6) {
    return NextResponse.json({ error: '유효하지 않은 주문번호예요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // 이미 인증했는지 확인
  const { data: existing } = await admin
    .from('unlock_records')
    .select('*')
    .eq('user_id', user_id)
    .eq('photo_id', photo_id)
    .single()

  if (existing?.verified) {
    return NextResponse.json({ success: true, already_verified: true })
  }

  // 인증 기록 저장
  const { error } = await admin
    .from('unlock_records')
    .upsert({
      user_id,
      photo_id,
      order_number,
      platform,
      verified: true,
    })

  if (error) {
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}