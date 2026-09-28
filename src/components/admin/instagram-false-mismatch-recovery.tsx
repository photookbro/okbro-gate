'use client'

import { useState } from 'react'

type Candidate = {
  id: string
  user_id: string
  email: string | null
  instagram_handle: string
  claimed_at: string
  flagged_at: string
  mismatch_push_likely: boolean
  handle_taken: boolean
}

type Preview = {
  flagged_total: number
  in_followers: number
  recoverable: number
  handle_taken: number
  push_likely_users: number
  candidates: Candidate[]
}

function n(value: number): string {
  return value.toLocaleString('ko-KR')
}

function formatTime(iso: string): string {
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

/** 부분 업로드로 잘못 회수된 불일치(실제 팔로워) 건 — 미리보기 확인 후 승인 복구 */
export function InstagramFalseMismatchRecovery({ token }: { token: string }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  async function loadPreview() {
    setLoading(true)
    setError('')
    setResult('')
    try {
      const res = await fetch('/api/admin/instagram-followers/false-mismatch', {
        headers: { 'x-admin-token': token },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '복구 대상 조회 실패')
        return
      }
      setPreview(data as Preview)
    } catch {
      setError('복구 대상 조회 중 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  async function recover() {
    if (!preview) return
    const ids = preview.candidates.filter(row => !row.handle_taken).map(row => row.id)
    if (ids.length === 0) return
    if (
      !window.confirm(
        `${n(ids.length)}건을 승인 처리하고 불일치 표시를 해제할까요?\n(푸시는 보내지 않아요)`
      )
    ) {
      return
    }

    setRecovering(true)
    setError('')
    try {
      const res = await fetch('/api/admin/instagram-followers/false-mismatch', {
        method: 'POST',
        headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '복구 실행 실패')
        return
      }
      setResult(
        `복구 완료: 요청 ${n(data.requested)}건 중 ${n(data.recovered)}건 승인` +
          (data.skipped > 0 ? ` · ${n(data.skipped)}건은 상태가 바뀌어 건너뜀` : '')
      )
      setPreview(null)
    } catch {
      setError('복구 실행 중 오류가 발생했어요')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <p className="label-field mb-0">불일치 오탐 복구</p>
      <p className="text-sm text-muted mb-0">
        불일치로 권한이 회수됐지만 아이디가 팔로워 목록에 있는 대기 신청을 찾아요. 목록을 확인한 뒤
        복구하면 승인 처리되고 불일치 표시가 해제돼요.
      </p>

      <div className="btn-row">
        <button
          type="button"
          className="btn-secondary-inline"
          disabled={loading || recovering}
          onClick={() => void loadPreview()}
        >
          {loading ? '조회 중...' : '대상 미리보기'}
        </button>
        {preview && preview.recoverable > 0 ? (
          <button
            type="button"
            className="btn-primary-inline"
            disabled={loading || recovering}
            onClick={() => void recover()}
          >
            {recovering ? '복구 중...' : `${n(preview.recoverable)}건 복구 실행`}
          </button>
        ) : null}
      </div>

      {error ? <p className="alert-danger mb-0">{error}</p> : null}
      {result ? <p className="alert-success mb-0">{result}</p> : null}

      {preview ? (
        <div className="space-y-2">
          <p className="text-sm mb-0">
            불일치 표시 대기 {n(preview.flagged_total)}건 중 팔로워 목록에 있는 건{' '}
            {n(preview.in_followers)}건 · 복구 대상 {n(preview.recoverable)}건
            {preview.handle_taken > 0
              ? ` · 같은 아이디가 이미 승인돼 제외 ${n(preview.handle_taken)}건`
              : ''}
            <br />
            불일치 푸시를 받았을 가능성이 높은 사용자 {n(preview.push_likely_users)}명 (회수 전부터
            푸시 구독이 남아 있는 사용자 기준 추정)
          </p>
          {preview.candidates.length > 0 ? (
            <div className="max-h-96 overflow-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[var(--bg)]">
                  <tr>
                    <th className="px-2 py-1">인스타 아이디</th>
                    <th className="px-2 py-1">이메일</th>
                    <th className="px-2 py-1">회수 시각</th>
                    <th className="px-2 py-1">불일치 푸시</th>
                    <th className="px-2 py-1">복구</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.candidates.map(row => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">{row.instagram_handle}</td>
                      <td className="px-2 py-1">{row.email ?? '-'}</td>
                      <td className="px-2 py-1">{formatTime(row.flagged_at)}</td>
                      <td className="px-2 py-1">{row.mismatch_push_likely ? '받았을 가능성 높음' : '-'}</td>
                      <td className="px-2 py-1">{row.handle_taken ? '제외(아이디 승인됨)' : '대상'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
