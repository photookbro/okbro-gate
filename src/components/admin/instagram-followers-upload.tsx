'use client'

import { useEffect, useState } from 'react'

type JobView = {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  file_name: string
  file_count: number
  progress_index: number
  total_parsed: number | null
  new_count: number | null
  updated_count: number | null
  summary: string | null
  error: string | null
  message: string
}

type InstagramFollowersUploadProps = {
  token: string
}

function formatSelectedFilesLabel(files: File[]): string {
  const names = files.map(f => f.name).join(', ')
  return `선택된 파일: ${names} (${files.length}개)`
}

function statusLabel(status: JobView['status']): string {
  if (status === 'queued') return '대기 중'
  if (status === 'processing') return '처리 중'
  if (status === 'completed') return '처리 완료'
  return '처리 실패'
}

export function InstagramFollowersUpload({ token }: InstagramFollowersUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [job, setJob] = useState<JobView | null>(null)

  useEffect(() => {
    if (!job) return
    if (job.status === 'completed' || job.status === 'failed') return

    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/admin/instagram-followers?job_id=${encodeURIComponent(job.job_id)}`,
          { headers: { 'x-admin-token': token } }
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : '상태 조회 실패')
          return
        }
        if (data.job) setJob(data.job as JobView)
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
  }, [job, token])

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setError('업로드할 HTML 파일을 선택해주세요')
      return
    }

    setUploading(true)
    setError('')
    setJob(null)

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
        return
      }

      setJob((data.job as JobView) ?? null)
      setSelectedFiles([])
    } catch {
      setError('업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
    }
  }

  const inFlight = job?.status === 'queued' || job?.status === 'processing'
  const progressTotal = job?.total_parsed ?? 0
  const progressDone = job?.progress_index ?? 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        인스타그램 &quot;내 정보 다운로드&quot;의 팔로워 HTML 파일(followers_1.html,
        followers_2.html 등)을 업로드하세요. 여러 개를 한 번에 선택할 수 있어요.
        <br />
        업로드하면 바로 접수되고, 분석·저장·대조는 백그라운드에서 이어집니다. 아래에서 진행 상태를
        확인할 수 있어요.
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
            {statusLabel(job.status)}
            {inFlight && progressTotal > 0
              ? ` · ${progressDone.toLocaleString('ko-KR')} / ${progressTotal.toLocaleString('ko-KR')}`
              : ''}
          </p>
          <p className="mb-0 text-sm">
            {job.status === 'completed'
              ? (job.summary ?? job.message)
              : job.status === 'failed'
                ? (job.error ?? job.message)
                : job.message}
            <br />
            파일: {job.file_name || '-'}
            {job.status === 'completed' && job.total_parsed != null ? (
              <>
                <br />
                추출 {job.total_parsed.toLocaleString('ko-KR')}건 · 신규{' '}
                {(job.new_count ?? 0).toLocaleString('ko-KR')}건 · 기존 갱신{' '}
                {(job.updated_count ?? 0).toLocaleString('ko-KR')}건
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}
