'use client'

import { useCallback, useEffect, useState } from 'react'
import { InstagramFalseMismatchRecovery } from '@/components/admin/instagram-false-mismatch-recovery'

type JobView = {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  phase: 'parse' | 'upsert' | 'match' | 'done' | null
  file_name: string
  file_count: number
  progress_index: number
  total_parsed: number | null
  matched_approved: number
  manual_unlock_mismatches: number
  handle_taken_revokes: number
  push_status: 'pending' | 'sending' | 'done' | null
  push_sent: number
  push_failed: number
  no_subscription: number
  mismatch_push_sent: number
  mismatch_push_failed: number
  mismatch_no_subscription: number
  mismatch_sweep: 'run' | 'skipped' | null
  mismatch_sweep_skip_message: string | null
  summary: string | null
  error: string | null
  created_at: string
  message: string
}

type SnapshotBaseline = {
  job_id: string
  file_count: number
  total_parsed: number
  created_at: string
}

type InstagramFollowersUploadProps = {
  token: string
}

function formatSelectedFilesLabel(files: File[]): string {
  const names = files.map(f => f.name).join(', ')
  return `선택된 파일: ${names} (${files.length}개)`
}

function statusLabel(job: JobView): string {
  if (job.status === 'queued') return '대기 중'
  if (job.status === 'processing') {
    if (job.phase === 'match') return '처리 중 · 대조'
    if (job.phase === 'parse') return '처리 중 · 분석'
    return '처리 중 · 저장'
  }
  if (job.status === 'completed') {
    return job.push_status === 'pending' || job.push_status === 'sending'
      ? '대조 완료 · 푸시 발송 중'
      : '처리 완료'
  }
  return '처리 실패'
}

function isJobInFlight(job: JobView | null): boolean {
  return job?.status === 'queued' || job?.status === 'processing'
}

function needsPolling(job: JobView | null): boolean {
  if (!job) return false
  if (isJobInFlight(job)) return true
  return job.status === 'completed' && (job.push_status === 'pending' || job.push_status === 'sending')
}

function formatJobTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function n(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('ko-KR')
}

export function InstagramFollowersUpload({ token }: InstagramFollowersUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [job, setJob] = useState<JobView | null>(null)
  const [recentJobs, setRecentJobs] = useState<JobView[]>([])
  const [snapshotBaseline, setSnapshotBaseline] = useState<SnapshotBaseline | null>(null)

  const loadRecentJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/instagram-followers', {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '최근 작업 조회 실패')
        return
      }
      const jobs = Array.isArray(data.jobs) ? (data.jobs as JobView[]) : []
      setRecentJobs(jobs)
      setSnapshotBaseline((data.snapshot_baseline as SnapshotBaseline | null) ?? null)
      setJob(current => current ?? jobs.find(needsPolling) ?? null)
    } catch {
      setError('최근 작업 조회 중 오류가 발생했어요')
    }
  }, [token])

  useEffect(() => {
    void loadRecentJobs()
  }, [loadRecentJobs])

  const polling = needsPolling(job)
  const jobId = job?.job_id

  useEffect(() => {
    if (!polling || !jobId) return

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/instagram-followers?job_id=${encodeURIComponent(jobId)}`,
          { headers: { 'x-admin-token': token } }
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '상태 조회 실패')
          return
        }
        if (data.job) {
          const next = data.job as JobView
          setJob(next)
          if (!needsPolling(next)) void loadRecentJobs()
        }
      } catch {
        if (!cancelled) setError('상태 조회 중 오류가 발생했어요')
      }
    }

    const timer = window.setInterval(() => {
      void poll()
    }, 2000)
    void poll()

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [polling, jobId, token, loadRecentJobs])

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setError('업로드할 HTML 파일을 선택해주세요')
      return
    }

    if (snapshotBaseline && selectedFiles.length !== snapshotBaseline.file_count) {
      const proceed = window.confirm(
        `지난 전체 업로드는 파일 ${snapshotBaseline.file_count}개(${n(snapshotBaseline.total_parsed)}건)였는데 이번에는 ${selectedFiles.length}개예요.\n` +
          '부분 목록이면 승인 매칭만 하고 불일치 회수는 건너뛰어요.\n계속 올릴까요?'
      )
      if (!proceed) return
    }

    setUploading(true)
    setError('')

    const formData = new FormData()
    for (const file of selectedFiles) {
      formData.append('file', file)
    }

    try {
      const res = await fetch('/api/admin/instagram-followers', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '업로드 실패')
        if (data.job) setJob(data.job as JobView)
        return
      }

      setJob((data.job as JobView) ?? null)
      setSelectedFiles([])
      void loadRecentJobs()
    } catch {
      setError('업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
    }
  }

  const inFlight = isJobInFlight(job)
  const progressTotal = job?.total_parsed ?? 0
  const progressDone = job?.progress_index ?? 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        인스타그램 &quot;내 정보 다운로드&quot;의 팔로워 HTML 파일(followers_1.html,
        followers_2.html 등)을 업로드하세요. 여러 개를 한 번에 선택할 수 있어요.
        <br />
        업로드하면 바로 접수되고, 분석·저장·대조는 백그라운드에서 이어집니다. 대조가 끝나면 먼저
        완료로 표시되고, 푸시는 그 뒤에 따로 발송돼요.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="label-field">HTML 파일 (여러 개 선택 가능)</span>
          <input
            type="file"
            accept=".html,text/html"
            multiple
            disabled={uploading || inFlight}
            className="input-field"
            onChange={e => {
              const next = Array.from(e.target.files ?? [])
              setSelectedFiles(next)
              setError('')
            }}
          />
        </label>
        <button
          type="button"
          className="btn-primary-inline shrink-0"
          disabled={uploading || inFlight || selectedFiles.length === 0}
          onClick={() => void handleUpload()}
        >
          {uploading ? '접수 중...' : inFlight ? '처리 중...' : 'UPLOAD'}
        </button>
      </div>

      {selectedFiles.length > 0 ? (
        <p className="text-sm text-muted">{formatSelectedFilesLabel(selectedFiles)}</p>
      ) : null}

      {error ? <p className="alert-danger mb-0">{error}</p> : null}

      {job ? (
        <div
          className={
            job.status === 'failed'
              ? 'alert-danger mb-0'
              : job.status === 'completed'
                ? 'alert-success mb-0'
                : 'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3'
          }
        >
          <p className="mb-1 font-semibold">
            {statusLabel(job)}
            {inFlight && job.phase !== 'match' && progressTotal > 0
              ? ` · ${n(progressDone)} / ${n(progressTotal)}`
              : ''}
          </p>
          <p className="mb-0 text-sm">
            {job.status === 'failed' ? (job.error ?? job.message) : job.message}
            <br />
            파일: {job.file_name || '-'} · 접수 {formatJobTime(job.created_at)}
            {job.status === 'completed' ? (
              <>
                <br />
                추출 {n(job.total_parsed)}건 · 승인 {n(job.matched_approved)}건 ·{' '}
                {job.mismatch_sweep === 'skipped'
                  ? job.mismatch_sweep_skip_message
                  : `불일치 회수 ${n(job.manual_unlock_mismatches)}건`}
                {job.handle_taken_revokes > 0
                  ? ` · 다른 계정에서 이미 사용된 아이디 ${n(job.handle_taken_revokes)}건 회수`
                  : ''}
                <br />
                승인 푸시 {n(job.push_sent)}명 (실패 {n(job.push_failed)} · 구독 없음{' '}
                {n(job.no_subscription)}) · 불일치 푸시 {n(job.mismatch_push_sent)}명 (실패{' '}
                {n(job.mismatch_push_failed)} · 구독 없음 {n(job.mismatch_no_subscription)})
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {recentJobs.length > 0 ? (
        <div>
          <p className="label-field">최근 업로드</p>
          <ul className="space-y-1 text-sm">
            {recentJobs.map(recent => (
              <li key={recent.job_id} className={recent.status === 'failed' ? 'text-danger' : 'text-muted'}>
                {formatJobTime(recent.created_at)} · {statusLabel(recent)} · {recent.file_name || '-'}
                {recent.status === 'completed'
                  ? ` · 승인 ${n(recent.matched_approved)} · ${
                      recent.mismatch_sweep === 'skipped'
                        ? '불일치 회수 건너뜀(부분 목록)'
                        : `불일치 ${n(recent.manual_unlock_mismatches)}`
                    }${
                      recent.handle_taken_revokes > 0
                        ? ` · 아이디 중복 ${n(recent.handle_taken_revokes)}`
                        : ''
                    }`
                  : ''}
                {recent.status === 'failed' && recent.error ? ` · ${recent.error}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <InstagramFalseMismatchRecovery token={token} />
    </div>
  )
}
