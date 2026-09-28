import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  chunkArray,
  mergeInstagramFollowerUsernames,
  parseInstagramFollowersFromHtml,
} from '@/lib/instagram-followers-parse'
import { matchPendingInstagramFollowClaims } from '@/lib/instagram-follow-approve-server'
import {
  decideMismatchSweep,
  type MismatchSweepSkipReason,
} from '@/lib/instagram-follow-match-plan'
import {
  countInstagramFollowPushOutbox,
  drainInstagramFollowPushOutbox,
  failStaleInstagramFollowPushSends,
} from '@/lib/instagram-follow-push-outbox-server'
import { invalidateAdminPlayersListCache } from '@/lib/admin-players-list-cache'

/** PostgREST 한 번에 넣기 좋은 크기 — 예전 500×다회 round-trip이 300s 타임아웃의 주원인 */
export const FOLLOWER_UPSERT_BATCH_SIZE = 1000
const UPSERT_CONCURRENCY = 3

/** 라우트 maxDuration(300s) 안에서 스스로 멈추고 상태를 남기기 위한 작업 예산 */
export const UPLOAD_JOB_BUDGET_MS = 270_000
/**
 * processing/queued 인데 이 시간 동안 updated_at 갱신이 없으면 죽은 작업.
 * 함수는 최대 300s만 살고 단계마다 heartbeat를 남기므로 6분이면 확실히 종료된 상태.
 */
export const UPLOAD_JOB_STALE_MS = 6 * 60_000
/** 푸시 발송 heartbeat가 이보다 오래되면 다른 요청에서 이어서 발송 */
const PUSH_RESUME_AFTER_MS = 90_000

export type InstagramFollowerUploadJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'

export type InstagramFollowerUploadJobPhase = 'parse' | 'upsert' | 'match' | 'done'
export type InstagramFollowerUploadPushStatus = 'pending' | 'sending' | 'done'
/** run: 전체 스냅샷으로 보고 불일치 회수 실행 · skipped: 부분 목록이라 승인 매칭만 */
export type InstagramFollowerMismatchSweep = 'run' | 'skipped'

export type InstagramFollowerUploadJob = {
  id: string
  status: InstagramFollowerUploadJobStatus
  phase: InstagramFollowerUploadJobPhase | null
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
  push_status: InstagramFollowerUploadPushStatus | null
  push_updated_at: string | null
  push_finished_at: string | null
  mismatch_sweep: InstagramFollowerMismatchSweep | null
  mismatch_sweep_skip_reason: MismatchSweepSkipReason | null
  snapshot_baseline_total: number | null
  summary: string | null
  error: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

const JOB_SELECT =
  'id, status, phase, file_names, file_count, progress_index, total_parsed, new_count, updated_count, matched_approved, push_sent, push_failed, no_subscription, manual_unlock_mismatches, mismatch_push_sent, mismatch_push_failed, mismatch_no_subscription, push_status, push_updated_at, push_finished_at, mismatch_sweep, mismatch_sweep_skip_reason, snapshot_baseline_total, summary, error, created_at, started_at, finished_at, updated_at'

export const PARTIAL_LIST_SWEEP_SKIPPED_MESSAGE = '부분 목록이라 불일치 회수는 하지 않았어요'

function sweepSkipDetail(job: {
  mismatch_sweep_skip_reason: MismatchSweepSkipReason | null
  snapshot_baseline_total: number | null
  total_parsed: number | null
}): string {
  if (job.mismatch_sweep_skip_reason === 'single_file') return '파일 1개'
  if (job.mismatch_sweep_skip_reason === 'smaller_than_previous') {
    return `이전 전체 목록 ${(job.snapshot_baseline_total ?? 0).toLocaleString('ko-KR')}건 대비 ${(job.total_parsed ?? 0).toLocaleString('ko-KR')}건`
  }
  return ''
}

const STALE_JOB_ERROR =
  '처리가 6분 넘게 갱신되지 않아 중단된 것으로 표시했어요. 같은 파일을 다시 올리면 이미 반영된 건은 건너뛰고 이어서 처리돼요.'

function jobMessage(job: InstagramFollowerUploadJob): string {
  if (job.status === 'queued' || job.status === 'processing') {
    if (job.phase === 'match') return '저장 완료 · 대기 신청과 대조 중이에요.'
    return '접수됐습니다. 백그라운드에서 분석·저장 중이에요.'
  }
  if (job.status === 'completed') return job.summary ?? '처리 완료'
  return job.error ?? '처리 실패'
}

export function buildFollowerUploadJobPublicView(job: InstagramFollowerUploadJob) {
  const fileLabel =
    job.file_names.length <= 1
      ? (job.file_names[0] ?? '')
      : `${job.file_names.join(', ')} (${job.file_count}개)`

  return {
    job_id: job.id,
    status: job.status,
    phase: job.phase,
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
    push_status: job.push_status,
    push_finished_at: job.push_finished_at,
    mismatch_sweep: job.mismatch_sweep,
    mismatch_sweep_skip_reason: job.mismatch_sweep_skip_reason,
    mismatch_sweep_skip_message:
      job.mismatch_sweep === 'skipped'
        ? `${PARTIAL_LIST_SWEEP_SKIPPED_MESSAGE} (${sweepSkipDetail(job)})`
        : null,
    snapshot_baseline_total: job.snapshot_baseline_total,
    summary: job.summary,
    error: job.error,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    updated_at: job.updated_at,
    message: jobMessage(job),
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
    .select(JOB_SELECT)
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
    .select(JOB_SELECT)
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
    .select(JOB_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data as InstagramFollowerUploadJob[] | null) ?? []
}

export type InstagramFollowerSnapshotBaseline = {
  job_id: string
  file_count: number
  total_parsed: number
  created_at: string
}

/** 직전 전체 스냅샷: 완료 · 파일 2개 이상 · 불일치 회수를 건너뛰지 않은 가장 최근 작업 */
export async function getLatestInstagramFollowerSnapshotBaseline(
  admin: SupabaseClient,
  excludeJobId?: string
): Promise<InstagramFollowerSnapshotBaseline | null> {
  let query = admin
    .from('instagram_follower_upload_jobs')
    .select('id, file_count, total_parsed, created_at')
    .eq('status', 'completed')
    .gte('file_count', 2)
    .not('total_parsed', 'is', null)
    .or('mismatch_sweep.is.null,mismatch_sweep.eq.run')
  if (excludeJobId) query = query.neq('id', excludeJobId)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    job_id: data.id,
    file_count: data.file_count,
    total_parsed: data.total_parsed,
    created_at: data.created_at,
  }
}

/** 아직 살아 있는(갱신 중인) 업로드 작업 — 동시에 여러 건 돌지 않게 */
export async function getActiveInstagramFollowerUploadJob(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<InstagramFollowerUploadJob | null> {
  const cutoff = new Date(now.getTime() - UPLOAD_JOB_STALE_MS).toISOString()
  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .select(JOB_SELECT)
    .in('status', ['queued', 'processing'])
    .gte('updated_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as InstagramFollowerUploadJob | null) ?? null
}

/** 함수가 죽어 processing/queued 로 남은 작업을 failed 로 */
export async function failStaleInstagramFollowerUploadJobs(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - UPLOAD_JOB_STALE_MS).toISOString()
  const nowIso = now.toISOString()
  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .update({
      status: 'failed',
      error: STALE_JOB_ERROR,
      finished_at: nowIso,
      updated_at: nowIso,
    })
    .in('status', ['queued', 'processing'])
    .lt('updated_at', cutoff)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
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
  matched_approved: number
  manual_unlock_mismatches: number
  push_status: InstagramFollowerUploadPushStatus | null
  push_sent: number
  push_failed: number
  mismatch_push_sent: number
  mismatch_push_failed: number
  mismatch_sweep: InstagramFollowerMismatchSweep | null
  mismatch_sweep_skip_reason: MismatchSweepSkipReason | null
  snapshot_baseline_total: number | null
}): string {
  const parts = [
    `파일 ${job.file_count.toLocaleString('ko-KR')}개 · 총 ${(job.total_parsed ?? 0).toLocaleString('ko-KR')}건 처리`,
    `대기 중 ${job.matched_approved.toLocaleString('ko-KR')}건 승인`,
    job.mismatch_sweep === 'skipped'
      ? `${PARTIAL_LIST_SWEEP_SKIPPED_MESSAGE} (${sweepSkipDetail(job)})`
      : `수동 승인 불일치 ${job.manual_unlock_mismatches.toLocaleString('ko-KR')}건`,
  ]

  if (job.push_status === 'pending' || job.push_status === 'sending') {
    parts.push('푸시 발송 중')
  } else if (job.push_status === 'done') {
    parts.push(
      `승인 푸시 ${job.push_sent.toLocaleString('ko-KR')}명${job.push_failed > 0 ? `(실패 ${job.push_failed.toLocaleString('ko-KR')})` : ''}`
    )
    parts.push(
      `불일치 푸시 ${job.mismatch_push_sent.toLocaleString('ko-KR')}명${job.mismatch_push_failed > 0 ? `(실패 ${job.mismatch_push_failed.toLocaleString('ko-KR')})` : ''}`
    )
  }

  return parts.join(' · ')
}

async function touchJob(
  admin: SupabaseClient,
  jobId: string,
  fields: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await admin
    .from('instagram_follower_upload_jobs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) throw error
}

/** outbox 기준으로 푸시 건수·상태·요약을 다시 계산해 작업에 반영 */
export async function refreshInstagramFollowerUploadPushStats(
  admin: SupabaseClient,
  jobId: string
): Promise<{ remaining: number }> {
  const [stats, job] = await Promise.all([
    countInstagramFollowPushOutbox(admin, jobId),
    getInstagramFollowerUploadJob(admin, jobId),
  ])
  if (!job) return { remaining: stats.remaining }

  const nowIso = new Date().toISOString()
  const pushStatus: InstagramFollowerUploadPushStatus = stats.remaining > 0 ? 'sending' : 'done'
  const { remaining, ...counts } = stats

  const { error } = await admin
    .from('instagram_follower_upload_jobs')
    .update({
      ...counts,
      push_status: pushStatus,
      push_updated_at: nowIso,
      push_finished_at: pushStatus === 'done' ? (job.push_finished_at ?? nowIso) : null,
      summary:
        job.status === 'completed'
          ? buildCompletedSummary({ ...job, ...counts, push_status: pushStatus })
          : job.summary,
    })
    .eq('id', jobId)
  if (error) throw error

  return { remaining }
}

async function sendJobPushes(
  admin: SupabaseClient,
  jobId: string,
  deadlineAt: number
): Promise<void> {
  try {
    await admin
      .from('instagram_follower_upload_jobs')
      .update({ push_status: 'sending', push_updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .in('push_status', ['pending', 'sending'])

    await drainInstagramFollowPushOutbox(admin, {
      jobId,
      deadlineAt,
      onBatch: async () => {
        await refreshInstagramFollowerUploadPushStats(admin, jobId)
      },
    })
    await refreshInstagramFollowerUploadPushStats(admin, jobId)
  } catch (error) {
    // 대조 결과는 이미 completed — 남은 푸시는 다음 상태 조회 때 이어서 발송
    console.error('[instagram-followers-upload-job] push phase failed', jobId, error)
  }
}

/**
 * 상태 조회 시 호출: 죽은 작업 failed 처리 + 멈춘 푸시 정리.
 * 이어서 발송할 푸시가 있는 작업 id 를 돌려줌(발송은 호출자가 after 로).
 */
export async function reconcileInstagramFollowerUploadJobs(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ pushJobIds: string[] }> {
  await failStaleInstagramFollowerUploadJobs(admin, now)

  const { data, error } = await admin
    .from('instagram_follower_upload_jobs')
    .select('id, push_updated_at')
    .eq('status', 'completed')
    .in('push_status', ['pending', 'sending'])
  if (error) throw error

  const resumeCutoff = now.getTime() - PUSH_RESUME_AFTER_MS
  const idle = (data ?? []).filter(
    job => !job.push_updated_at || new Date(job.push_updated_at).getTime() < resumeCutoff
  )
  if (idle.length === 0) return { pushJobIds: [] }

  await failStaleInstagramFollowPushSends(admin, now)

  const pushJobIds: string[] = []
  for (const job of idle) {
    const { remaining } = await refreshInstagramFollowerUploadPushStats(admin, job.id)
    if (remaining > 0) pushJobIds.push(job.id)
  }
  return { pushJobIds }
}

export async function resumeInstagramFollowerUploadPushes(
  admin: SupabaseClient,
  jobIds: string[]
): Promise<void> {
  const deadlineAt = Date.now() + UPLOAD_JOB_BUDGET_MS
  for (const jobId of jobIds) {
    await sendJobPushes(admin, jobId, deadlineAt)
  }
}

/** 백그라운드: HTML 파싱 → 벌크 upsert → 대조 확정(completed) → 푸시 발송 */
export async function processInstagramFollowerUploadJob(
  admin: SupabaseClient,
  jobId: string,
  options?: { htmlTexts?: string[] }
): Promise<void> {
  const deadlineAt = Date.now() + UPLOAD_JOB_BUDGET_MS
  const hasHtml = Boolean(options?.htmlTexts && options.htmlTexts.length > 0)

  const { data: claimed, error: claimError } = await admin
    .from('instagram_follower_upload_jobs')
    .update({
      status: 'processing',
      phase: hasHtml ? 'parse' : 'upsert',
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
  if (hasHtml) {
    try {
      const parsedLists = options!.htmlTexts!.map(html => parseInstagramFollowersFromHtml(html))
      usernames = mergeInstagramFollowerUsernames(parsedLists)
      await touchJob(admin, jobId, {
        usernames,
        total_parsed: usernames.length,
        phase: 'upsert',
      })
    } catch (error) {
      console.error('[instagram-followers-upload-job] parse failed', jobId, error)
      await touchJob(admin, jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'HTML 분석 중 오류가 발생했어요',
        finished_at: new Date().toISOString(),
      })
      return
    }
  }

  if (usernames.length === 0) {
    await touchJob(admin, jobId, {
      status: 'failed',
      error: '팔로워 아이디를 찾지 못했어요',
      finished_at: new Date().toISOString(),
    })
    return
  }

  let pushPending = false
  try {
    // instagram_followers 전체 exact count는 대량 테이블에서 수분 걸릴 수 있어 생략
    const startIndex = Math.max(0, Number(claimed.progress_index) || 0)

    await upsertUsernameBatches(admin, usernames, startIndex, async nextIndex => {
      await touchJob(admin, jobId, { progress_index: nextIndex })
    })

    const totalParsed = usernames.length
    const baseline = await getLatestInstagramFollowerSnapshotBaseline(admin, jobId)
    const sweepDecision = decideMismatchSweep({
      fileCount: claimed.file_count,
      totalParsed,
      baselineTotal: baseline?.total_parsed ?? null,
    })
    const sweepFields = {
      mismatch_sweep: (sweepDecision.sweep ? 'run' : 'skipped') as InstagramFollowerMismatchSweep,
      mismatch_sweep_skip_reason: sweepDecision.sweep ? null : sweepDecision.reason,
      snapshot_baseline_total: baseline?.total_parsed ?? null,
    }
    await touchJob(admin, jobId, {
      phase: 'match',
      progress_index: totalParsed,
      ...sweepFields,
    })

    const matchResult = await matchPendingInstagramFollowClaims(admin, usernames, {
      jobId,
      sweepMismatches: sweepDecision.sweep,
      onProgress: () => touchJob(admin, jobId),
    })
    invalidateAdminPlayersListCache()

    const { remaining, ...pushCounts } = await countInstagramFollowPushOutbox(admin, jobId)
    pushPending = remaining > 0
    const pushStatus: InstagramFollowerUploadPushStatus = pushPending ? 'pending' : 'done'
    const nowIso = new Date().toISOString()

    const completed = {
      matched_approved: matchResult.approved,
      manual_unlock_mismatches: matchResult.manual_unlock_mismatches,
      ...pushCounts,
      push_status: pushStatus,
    }

    await touchJob(admin, jobId, {
      status: 'completed',
      phase: 'done',
      progress_index: totalParsed,
      total_parsed: totalParsed,
      new_count: null,
      updated_count: null,
      ...completed,
      push_updated_at: nowIso,
      push_finished_at: pushPending ? null : nowIso,
      summary: buildCompletedSummary({
        file_count: claimed.file_count,
        total_parsed: totalParsed,
        ...completed,
        ...sweepFields,
      }),
      usernames: [],
      finished_at: nowIso,
      error: null,
    })
  } catch (error) {
    console.error('[instagram-followers-upload-job] process failed', jobId, error)
    await touchJob(admin, jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : '처리 중 오류가 발생했어요',
      finished_at: new Date().toISOString(),
    })
    return
  }

  if (pushPending) {
    await sendJobPushes(admin, jobId, deadlineAt)
  }
}
