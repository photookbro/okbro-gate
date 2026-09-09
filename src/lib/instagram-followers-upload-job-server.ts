import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  chunkArray,
  mergeInstagramFollowerUsernames,
  parseInstagramFollowersFromHtml,
} from '@/lib/instagram-followers-parse'
import { matchPendingInstagramFollowClaims } from '@/lib/instagram-follow-approve-server'
import { invalidateAdminPlayersListCache } from '@/lib/admin-players-list-cache'

/** PostgREST 한 번에 넣기 좋은 크기 — 예전 500×다회 round-trip이 300s 타임아웃의 주원인 */
export const FOLLOWER_UPSERT_BATCH_SIZE = 1000
const UPSERT_CONCURRENCY = 3

export type InstagramFollowerUploadJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export type InstagramFollowerUploadJob = {
  id: string
  status: InstagramFollowerUploadJobStatus
  file_names: string[]
  file_count: number
  usernames?: string[] | null
  progress_index: number
  total_parsed: number | null
  new_count: number | null
  updated_count: number | null
  matched_approved: number
  push_sent: number
  push_failed: number
  no_subscription: number
  manual_unlock_mismatches: number
  mismatch_push_sent: number
  mismatch_push_failed: number
  mismatch_no_subscription: number
  summary: string | null
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export function buildFollowerUploadJobPublicView(job: InstagramFollowerUploadJob) {
  const fileLabel =
    job.file_names.length <= 1
      ? (job.file_names[0] ?? '')
      : `${job.file_names.join(', ')} (${job.file_count}개)`

  return {
    job_id: job.id,
    status: job.status,
    file_name: fileLabel,
    file_names: job.file_names,
    file_count: job.file_count,
    progress_index: job.progress_index,
    total_parsed: job.total_parsed,
    new_count: job.new_count,
    updated_count: job.updated_count,
    matched_approved: job.matched_approved,
    push_sent: job.push_sent,
    push_failed: job.push_failed,
    no_subscription: job.no_subscription,
    manual_unlock_mismatches: job.manual_unlock_mismatches,
    mismatch_push_sent: job.mismatch_push_sent,
    mismatch_push_failed: job.mismatch_push_failed,
    mismatch_no_subscription: job.mismatch_no_subscription,
    summary: job.summary,
    error: job.error,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    message:
      job.status === 'queued' || job.status === 'processing'
        ? '접수됐습니다. 백그라운드에서 분석·저장 중이에요.'
        : job.status === 'completed'
          ? (job.summary ?? '처리 완료')
          : (job.error ?? '처리 실패'),
  }
}

export async function createInstagramFollowerUploadJob(
  admin: SupabaseClient,
  options: { fileNames: string[]; usernames?: string[] }
): Promise<InstagramFollowerUploadJob> {
  const nowIso = new Date().toISOString()
  const usernames = options.usernames ?? []
  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .insert({
      status: 'queued',
      file_names: options.fileNames,
      file_count: options.fileNames.length,
      usernames,
      progress_index: 0,
      total_parsed: usernames.length > 0 ? usernames.length : null,
      updated_at: nowIso,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as InstagramFollowerUploadJob
}

export async function getInstagramFollowerUploadJob(
  admin: SupabaseClient,
  jobId: string
): Promise<InstagramFollowerUploadJob | null> {
  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .select(
      'id, status, file_names, file_count, progress_index, total_parsed, new_count, updated_count, matched_approved, push_sent, push_failed, no_subscription, manual_unlock_mismatches, mismatch_push_sent, mismatch_push_failed, mismatch_no_subscription, summary, error, created_at, started_at, finished_at, updated_at'
    )
    .eq('id', jobId)
    .maybeSingle()

  if (error) throw error
  return (data as InstagramFollowerUploadJob | null) ?? null
}

export async function getLatestInstagramFollowerUploadJobs(
  admin: SupabaseClient,
  limit = 5
): Promise<InstagramFollowerUploadJob[]> {
  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .select(
      'id, status, file_names, file_count, progress_index, total_parsed, new_count, updated_count, matched_approved, push_sent, push_failed, no_subscription, manual_unlock_mismatches, mismatch_push_sent, mismatch_push_failed, mismatch_no_subscription, summary, error, created_at, started_at, finished_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as InstagramFollowerUploadJob[] | null) ?? []
}

async function upsertUsernameBatches(
  admin: SupabaseClient,
  usernames: string[],
  startIndex: number,
  onProgress: (nextIndex: number) => Promise<void>
): Promise<number> {
  const remaining = usernames.slice(startIndex)
  const batches = chunkArray(remaining, FOLLOWER_UPSERT_BATCH_SIZE)
  let nextIndex = startIndex
  const nowIso = new Date().toISOString()

  for (let i = 0; i < batches.length; i += UPSERT_CONCURRENCY) {
    const slice = batches.slice(i, i + UPSERT_CONCURRENCY)
    await Promise.all(
      slice.map(async batch => {
        const rows = batch.map(username => ({
          username,
          updated_at: nowIso,
        }))
        const { error } = await admin
          .from('instagram_followers')
          .upsert(rows, { onConflict: 'username', ignoreDuplicates: false })
        if (error) throw error
      })
    )

    nextIndex += slice.reduce((sum, batch) => sum + batch.length, 0)
    await onProgress(nextIndex)
  }

  return nextIndex
}

function buildCompletedSummary(job: {
  file_count: number
  total_parsed: number | null
  new_count: number | null
  matched_approved: number
  push_sent: number
  manual_unlock_mismatches: number
  mismatch_push_sent: number
}): string {
  const parts = [
    `파일 ${job.file_count.toLocaleString('ko-KR')}개 · 총 ${(job.total_parsed ?? 0).toLocaleString('ko-KR')}건 처리`,
  ]
  if (job.new_count != null) {
    parts[0] += ` (신규 ${(job.new_count ?? 0).toLocaleString('ko-KR')}건)`
  }
  if (job.matched_approved > 0) {
    parts.push(`대기 중 ${job.matched_approved.toLocaleString('ko-KR')}건 승인`)
  }
  if (job.push_sent > 0) {
    parts.push(`푸시 ${job.push_sent.toLocaleString('ko-KR')}건 발송`)
  }
  if (job.manual_unlock_mismatches > 0) {
    parts.push(
      `수동 승인 불일치 ${job.manual_unlock_mismatches.toLocaleString('ko-KR')}건`
    )
  }
  if (job.mismatch_push_sent > 0) {
    parts.push(`불일치 안내 푸시 ${job.mismatch_push_sent.toLocaleString('ko-KR')}건`)
  }
  return parts.join(' · ')
}

/** 백그라운드에서 HTML 파싱 + 벌크 upsert + 대기 신청 대조 */
export async function processInstagramFollowerUploadJob(
  admin: SupabaseClient,
  jobId: string,
  options?: { htmlTexts?: string[] }
): Promise<void> {
  const { data: claimed, error: claimError } = await admin
    .from('instagram_follower_upload_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', jobId)
    .in('status', ['queued', 'processing'])
    .select('id, status, file_names, file_count, usernames, progress_index, total_parsed')
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed) return

  let usernames = Array.isArray(claimed.usernames)
    ? claimed.usernames.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []

  // HTML 파싱은 요청 경로가 아니라 after() 백그라운드에서 수행
  if (options?.htmlTexts && options.htmlTexts.length > 0) {
    try {
      const parsedLists = options.htmlTexts.map(html => parseInstagramFollowersFromHtml(html))
      usernames = mergeInstagramFollowerUsernames(parsedLists)
      await admin
        .from('instagram_follower_upload_jobs')
        .update({
          usernames,
          total_parsed: usernames.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    } catch (error) {
      console.error('[instagram-followers-upload-job] parse failed', jobId, error)
      await admin
        .from('instagram_follower_upload_jobs')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'HTML 분석 중 오류가 발생했어요',
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
      return
    }
  }

  if (usernames.length === 0) {
    await admin
      .from('instagram_follower_upload_jobs')
      .update({
        status: 'failed',
        error: '팔로워 아이디를 찾지 못했어요',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    return
  }

  try {
    // instagram_followers 전체 exact count는 대량 테이블에서 수분 걸릴 수 있어 생략
    const startIndex = Math.max(0, Number(claimed.progress_index) || 0)

    await upsertUsernameBatches(admin, usernames, startIndex, async nextIndex => {
      await admin
        .from('instagram_follower_upload_jobs')
        .update({
          progress_index: nextIndex,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    })

    const totalParsed = usernames.length
    const matchResult = await matchPendingInstagramFollowClaims(admin, usernames)
    invalidateAdminPlayersListCache()
    const summary = buildCompletedSummary({
      file_count: claimed.file_count,
      total_parsed: totalParsed,
      new_count: null,
      matched_approved: matchResult.approved,
      push_sent: matchResult.push_sent,
      manual_unlock_mismatches: matchResult.manual_unlock_mismatches,
      mismatch_push_sent: matchResult.mismatch_push_sent,
    })

    await admin
      .from('instagram_follower_upload_jobs')
      .update({
        status: 'completed',
        progress_index: totalParsed,
        total_parsed: totalParsed,
        new_count: null,
        updated_count: null,
        matched_approved: matchResult.approved,
        push_sent: matchResult.push_sent,
        push_failed: matchResult.push_failed,
        no_subscription: matchResult.no_subscription,
        manual_unlock_mismatches: matchResult.manual_unlock_mismatches,
        mismatch_push_sent: matchResult.mismatch_push_sent,
        mismatch_push_failed: matchResult.mismatch_push_failed,
        mismatch_no_subscription: matchResult.mismatch_no_subscription,
        summary,
        usernames: [],
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error: null,
      })
      .eq('id', jobId)
  } catch (error) {
    console.error('[instagram-followers-upload-job] process failed', jobId, error)
    await admin
      .from('instagram_follower_upload_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : '처리 중 오류가 발생했어요',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  }
}
