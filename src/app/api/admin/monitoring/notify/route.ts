import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'

const EMAIL_BODY =
  '안녕하세요! 오켱게이트 인증이 30일 후 만료돼요. 재구매 인증 시 기간이 연장됩니다.'

async function sendExpiryEmail(to: string) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to,
        subject: '오켱게이트 인증 만료 안내',
        text: EMAIL_BODY,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`이메일 발송 실패: ${detail}`)
    }

    return true
  }

  console.log('[expiry-notify]', to, EMAIL_BODY)
  return false
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { order_id } = await req.json()
  if (!order_id) {
    return NextResponse.json({ error: 'order_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: order, error } = await admin
    .from('orders')
    .select('id, user_id, expiry_notified_at')
    .eq('id', order_id)
    .maybeSingle()

  if (error || !order) {
    return NextResponse.json({ error: '주문 정보를 찾을 수 없어요' }, { status: 404 })
  }

  if (order.expiry_notified_at) {
    return NextResponse.json({ success: true, already_sent: true })
  }

  const { data: authUser } = await admin.auth.admin.getUserById(order.user_id)
  const email = authUser.user?.email

  if (!email) {
    return NextResponse.json({ error: '유저 이메일을 찾을 수 없어요' }, { status: 404 })
  }

  try {
    await sendExpiryEmail(email)
  } catch (err) {
    const message = err instanceof Error ? err.message : '이메일 발송 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({ expiry_notified_at: new Date().toISOString() })
    .eq('id', order_id)

  if (updateError) {
    return NextResponse.json({ error: '발송 기록 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email_sent: true })
}
