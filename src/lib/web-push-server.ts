import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'

let vapidConfigured = false

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function configureWebPush(): boolean {
  if (vapidConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@okbro.com'

  if (!publicKey || !privateKey) {
    console.error(
      '[web-push] VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY'
    )
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
}

export type PushSendResult = {
  sent: number
  failed: number
  no_subscription: boolean
  vapid_missing: boolean
  query_error: boolean
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!userId) {
    return {
      sent: 0,
      failed: 0,
      no_subscription: true,
      vapid_missing: false,
      query_error: false,
    }
  }

  if (!configureWebPush()) {
    return {
      sent: 0,
      failed: 0,
      no_subscription: false,
      vapid_missing: true,
      query_error: false,
    }
  }

  const admin = supabaseAdmin()
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.error('[web-push] push_subscriptions query failed:', error)
    return {
      sent: 0,
      failed: 0,
      no_subscription: false,
      vapid_missing: false,
      query_error: true,
    }
  }

  if (!subscriptions?.length) {
    return {
      sent: 0,
      failed: 0,
      no_subscription: true,
      vapid_missing: false,
      query_error: false,
    }
  }

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/mypage',
  })

  let sent = 0
  let failed = 0

  await Promise.all(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        )
        sent++
      } catch (err) {
        failed++
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    })
  )

  return {
    sent,
    failed,
    no_subscription: sent === 0 && failed === 0,
    vapid_missing: false,
    query_error: false,
  }
}
