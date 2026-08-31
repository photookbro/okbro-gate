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

export type PushBroadcastResult = {
  users_targeted: number
  push_sent: number
  push_failed: number
  no_subscription_users: number
  vapid_missing: boolean
  query_error: boolean
}

/** 구독 중인 모든 유저(중복 user_id 제거)에게 동일 페이로드 발송. */
export async function sendPushToAllSubscribers(
  payload: PushPayload
): Promise<PushBroadcastResult> {
  if (!configureWebPush()) {
    return {
      users_targeted: 0,
      push_sent: 0,
      push_failed: 0,
      no_subscription_users: 0,
      vapid_missing: true,
      query_error: false,
    }
  }

  const admin = supabaseAdmin()
  const { data: rows, error } = await admin.from('push_subscriptions').select('user_id')

  if (error) {
    console.error('[web-push] broadcast user_id query failed:', error)
    return {
      users_targeted: 0,
      push_sent: 0,
      push_failed: 0,
      no_subscription_users: 0,
      vapid_missing: false,
      query_error: true,
    }
  }

  const userIds = [
    ...new Set(
      (rows ?? [])
        .map(row => (typeof row.user_id === 'string' ? row.user_id : ''))
        .filter((id): id is string => id.length > 0)
    ),
  ]

  if (!userIds.length) {
    return {
      users_targeted: 0,
      push_sent: 0,
      push_failed: 0,
      no_subscription_users: 0,
      vapid_missing: false,
      query_error: false,
    }
  }

  let pushSent = 0
  let pushFailed = 0
  let noSubscriptionUsers = 0

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload)
    if (result.vapid_missing) {
      return {
        users_targeted: userIds.length,
        push_sent: pushSent,
        push_failed: pushFailed,
        no_subscription_users: noSubscriptionUsers,
        vapid_missing: true,
        query_error: false,
      }
    }
    if (result.query_error) {
      return {
        users_targeted: userIds.length,
        push_sent: pushSent,
        push_failed: pushFailed,
        no_subscription_users: noSubscriptionUsers,
        vapid_missing: false,
        query_error: true,
      }
    }
    if (result.sent > 0) {
      pushSent += result.sent
    } else if (result.failed > 0) {
      pushFailed += result.failed
    } else if (result.no_subscription) {
      noSubscriptionUsers++
    }
  }

  return {
    users_targeted: userIds.length,
    push_sent: pushSent,
    push_failed: pushFailed,
    no_subscription_users: noSubscriptionUsers,
    vapid_missing: false,
    query_error: false,
  }
}
