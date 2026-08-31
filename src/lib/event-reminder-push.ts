import { supabaseAdmin } from '@/lib/supabase-admin'
import { kstDateStringPlusDays } from '@/lib/events-list-classify'
import { formatEventDateDisplay } from '@/lib/events-list-client'
import { isWebPushConfigured, sendPushToAllSubscribers } from '@/lib/web-push-server'

export type EventReminderRow = {
  id: string
  name: string
  date: string
  is_pay_event: boolean
}

export function buildEventReminderBody(event: EventReminderRow): string {
  const dateLabel = formatEventDateDisplay(event.date)
  if (event.is_pay_event) {
    return `${dateLabel} ${event.name}에 참가하신다면, 오켱이 공식 작가로 함께해요! 별도 인증 없이 이용 가능하니 GPS만 켜두시면 됩니다`
  }
  return `${dateLabel} ${event.name}에 참가하신다면, GPS를 켜두고 인증(구매 또는 인스타 팔로우)까지 미리 해두세요`
}

export type EventReminderPushItemResult = {
  event_id: string
  event_name: string
  is_pay_event: boolean
  users_targeted: number
  push_sent: number
  push_failed: number
  no_subscription_users: number
}

export type EventReminderPushRunResult = {
  target_date: string
  events_found: number
  vapid_missing: boolean
  query_error: boolean
  pushes: EventReminderPushItemResult[]
}

export async function runEventReminderPush(
  options?: { daysAhead?: number; now?: Date }
): Promise<EventReminderPushRunResult> {
  const daysAhead = options?.daysAhead ?? 2
  const targetDate = kstDateStringPlusDays(daysAhead, options?.now)

  const admin = supabaseAdmin()
  const { data: events, error } = await admin
    .from('events')
    .select('id, name, date, is_pay_event')
    .eq('date', targetDate)
    .order('name', { ascending: true })

  if (error) {
    console.error('[event-reminder-push] events query failed:', error)
    return {
      target_date: targetDate,
      events_found: 0,
      vapid_missing: false,
      query_error: true,
      pushes: [],
    }
  }

  const rows = (events ?? []).map(event => ({
    id: event.id as string,
    name: event.name as string,
    date: event.date as string,
    is_pay_event: event.is_pay_event === true,
  }))

  if (!rows.length) {
    return {
      target_date: targetDate,
      events_found: 0,
      vapid_missing: false,
      query_error: false,
      pushes: [],
    }
  }

  if (!isWebPushConfigured()) {
    return {
      target_date: targetDate,
      events_found: rows.length,
      vapid_missing: true,
      query_error: false,
      pushes: [],
    }
  }

  const pushes: EventReminderPushItemResult[] = []

  for (const event of rows) {
    const broadcast = await sendPushToAllSubscribers({
      title: 'OKbroGATE',
      body: buildEventReminderBody(event),
      url: `/events/${event.id}`,
    })

    if (broadcast.vapid_missing || broadcast.query_error) {
      return {
        target_date: targetDate,
        events_found: rows.length,
        vapid_missing: broadcast.vapid_missing,
        query_error: broadcast.query_error,
        pushes,
      }
    }

    pushes.push({
      event_id: event.id,
      event_name: event.name,
      is_pay_event: event.is_pay_event,
      users_targeted: broadcast.users_targeted,
      push_sent: broadcast.push_sent,
      push_failed: broadcast.push_failed,
      no_subscription_users: broadcast.no_subscription_users,
    })
  }

  return {
    target_date: targetDate,
    events_found: rows.length,
    vapid_missing: false,
    query_error: false,
    pushes,
  }
}
