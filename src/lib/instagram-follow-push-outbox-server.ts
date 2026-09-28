import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  instagramFollowApprovedPushBody,
  instagramFollowMismatchPushBody,
} from '@/lib/instagram-follow-copy'
import { sendPushToUser, type PushSendResult } from '@/lib/web-push-server'

const PUSH_CLAIM_BATCH = 50
const PUSH_SEND_CONCURRENCY = 10
/** claim 후 이 시간 넘게 sending 이면 발송 여부를 알 수 없어 재발송하지 않고 failed 처리 */
export const PUSH_SENDING_STALE_MS = 5 * 60_000

type OutboxKind = 'approved' | 'mismatch'
type OutboxFinalStatus = 'sent' | 'failed' | 'no_subscription'

type ClaimedOutboxRow = {
  id: string
  job_id: string
  user_id: string
  kind: OutboxKind
  bonus_days: number | null
}

export type OutboxPushStats = {
  push_sent: number
  push_failed: number
  no_subscription: number
  mismatch_push_sent: number
  mismatch_push_failed: number
  mismatch_no_subscription: number
  remaining: number
}

function classifyPushResult(result: PushSendResult): { status: OutboxFinalStatus; error: string | null } {
  if (result.vapid_missing) return { status: 'failed', error: 'vapid_missing' }
  if (result.query_error) return { status: 'failed', error: 'subscription_query_failed' }
  if (result.sent > 0) return { status: 'sent', error: null }
  if (result.failed > 0) return { status: 'failed', error: 'push_delivery_failed' }
  return { status: 'no_subscription', error: null }
}

async function sendOutboxRow(row: ClaimedOutboxRow): Promise<PushSendResult> {
  const body =
    row.kind === 'approved'
      ? instagramFollowApprovedPushBody(row.bonus_days ?? 0)
      : instagramFollowMismatchPushBody()
  return sendPushToUser(row.user_id, {
    title: 'OKbroGATE',
    body,
    url: row.kind === 'approved' ? '/mypage' : '/instagram-follow',
  })
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await fn(items[index])
      }
    })
  )
  return results
}

/**
 * outbox pending 건을 claim(pending→sending) 후 발송.
 * claim 된 건만 보내므로 동시에 여러 번 호출돼도 같은 푸시가 두 번 나가지 않음.
 */
export async function drainInstagramFollowPushOutbox(
  admin: SupabaseClient,
  options: { jobId?: string; deadlineAt: number; onBatch?: () => Promise<void> }
): Promise<{ processed: number; remaining: boolean }> {
  let processed = 0

  for (;;) {
    if (Date.now() >= options.deadlineAt) return { processed, remaining: true }

    let pendingQuery = admin
      .from('instagram_follow_push_outbox')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(PUSH_CLAIM_BATCH)
    if (options.jobId) pendingQuery = pendingQuery.eq('job_id', options.jobId)

    const { data: pending, error: pendingError } = await pendingQuery
    if (pendingError) throw pendingError
    if (!pending || pending.length === 0) return { processed, remaining: false }

    const claimedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await admin
      .from('instagram_follow_push_outbox')
      .update({ status: 'sending', claimed_at: claimedAt })
      .in(
        'id',
        pending.map(row => row.id)
      )
      .eq('status', 'pending')
      .select('id, job_id, user_id, kind, bonus_days')
    if (claimError) throw claimError

    const rows = (claimed as ClaimedOutboxRow[] | null) ?? []
    const outcomes = await mapWithConcurrency(rows, PUSH_SEND_CONCURRENCY, async row => {
      try {
        return { row, ...classifyPushResult(await sendOutboxRow(row)) }
      } catch (error) {
        console.error('[instagram-push-outbox] send failed', row.id, error)
        return { row, status: 'failed' as const, error: 'push_exception' }
      }
    })

    const groups = new Map<string, { status: OutboxFinalStatus; error: string | null; ids: string[] }>()
    for (const outcome of outcomes) {
      const key = `${outcome.status}:${outcome.error ?? ''}`
      const group = groups.get(key) ?? { status: outcome.status, error: outcome.error, ids: [] }
      group.ids.push(outcome.row.id)
      groups.set(key, group)
    }

    const sentAt = new Date().toISOString()
    for (const group of groups.values()) {
      const { error } = await admin
        .from('instagram_follow_push_outbox')
        .update({ status: group.status, error: group.error, sent_at: sentAt })
        .in('id', group.ids)
        .eq('status', 'sending')
      if (error) throw error
    }

    processed += rows.length
    await options.onBatch?.()
  }
}

/** sending 에서 멈춘 건 정리 — 발송됐을 수도 있으므로 재발송 대신 failed */
export async function failStaleInstagramFollowPushSends(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<void> {
  const cutoff = new Date(now.getTime() - PUSH_SENDING_STALE_MS).toISOString()
  const { error } = await admin
    .from('instagram_follow_push_outbox')
    .update({ status: 'failed', error: 'stale_sending', sent_at: now.toISOString() })
    .eq('status', 'sending')
    .lt('claimed_at', cutoff)
  if (error) throw error
}

export async function countInstagramFollowPushOutbox(
  admin: SupabaseClient,
  jobId: string
): Promise<OutboxPushStats> {
  const countWhere = async (kind: OutboxKind | null, statuses: string[]) => {
    let query = admin
      .from('instagram_follow_push_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .in('status', statuses)
    if (kind) query = query.eq('kind', kind)
    const { count, error } = await query
    if (error) throw error
    return count ?? 0
  }

  const [
    pushSent,
    pushFailed,
    noSubscription,
    mismatchSent,
    mismatchFailed,
    mismatchNoSubscription,
    remaining,
  ] = await Promise.all([
    countWhere('approved', ['sent']),
    countWhere('approved', ['failed']),
    countWhere('approved', ['no_subscription']),
    countWhere('mismatch', ['sent']),
    countWhere('mismatch', ['failed']),
    countWhere('mismatch', ['no_subscription']),
    countWhere(null, ['pending', 'sending']),
  ])

  return {
    push_sent: pushSent,
    push_failed: pushFailed,
    no_subscription: noSubscription,
    mismatch_push_sent: mismatchSent,
    mismatch_push_failed: mismatchFailed,
    mismatch_no_subscription: mismatchNoSubscription,
    remaining,
  }
}
