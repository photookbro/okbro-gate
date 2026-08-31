import { NextRequest, NextResponse } from 'next/server'
import { runEventReminderPush } from '@/lib/event-reminder-push'

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runEventReminderPush()

  if (result.vapid_missing) {
    return NextResponse.json(
      {
        error:
          '웹푸시 VAPID 키가 서버에 설정되지 않았어요. NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY를 확인해주세요.',
        ...result,
      },
      { status: 503 }
    )
  }

  if (result.query_error) {
    return NextResponse.json({ error: '대회 조회 또는 푸시 발송에 실패했어요', ...result }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    ...result,
  })
}
