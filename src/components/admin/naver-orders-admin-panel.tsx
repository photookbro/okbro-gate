'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SuspectOrderRow } from '@/lib/naver-orders-reconcile'

type UploadResult = {
  summary: string
  total_parsed: number
  new_count: number
  updated_count: number
  file_name: string
}

type DuplicateAttempt = {
  id: string
  user_id: string | null
  user_email: string | null
  order_number: string
  platform: string | null
  outcome: string
  existing_user_id: string | null
  created_at: string
}

type NaverOrdersAdminPanelProps = {
  token: string
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NaverOrdersAdminPanel({ token }: NaverOrdersAdminPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [reconciling, setReconciling] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [reconcileError, setReconcileError] = useState('')
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [reconcileSummary, setReconcileSummary] = useState('')
  const [forgery, setForgery] = useState<SuspectOrderRow[]>([])
  const [duplicate, setDuplicate] = useState<SuspectOrderRow[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<DuplicateAttempt[]>([])
  const [attemptsError, setAttemptsError] = useState('')
  const [attemptsLoading, setAttemptsLoading] = useState(false)

  const headers = useCallback(() => ({ 'x-admin-token': token }), [token])

  const loadAttempts = useCallback(async () => {
    setAttemptsLoading(true)
    setAttemptsError('')
    try {
      const res = await fetch('/api/admin/naver-orders/attempts?limit=50', {
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) {
        setAttemptsError(typeof data.error === 'string' ? data.error : '로그 로드 실패')
        return
      }
      setAttempts((data.attempts as DuplicateAttempt[]) ?? [])
    } catch {
      setAttemptsError('로그 로드 실패')
    } finally {
      setAttemptsLoading(false)
    }
  }, [headers])

  useEffect(() => {
    void loadAttempts()
  }, [loadAttempts])

  async function handleUpload() {
    if (!selectedFile) {
      setUploadError('업로드할 엑셀 파일을 선택해주세요')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch('/api/admin/naver-orders/upload', {
        method: 'POST',
        headers: headers(),
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(typeof data.error === 'string' ? data.error : '업로드 실패')
        return
      }

      setUploadResult({
        summary: data.summary ?? '',
        total_parsed: data.total_parsed ?? 0,
        new_count: data.new_count ?? 0,
        updated_count: data.updated_count ?? 0,
        file_name: data.file_name ?? selectedFile.name,
      })
      setSelectedFile(null)
    } catch {
      setUploadError('업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
    }
  }

  async function handleReconcile() {
    setReconciling(true)
    setReconcileError('')
    setReconcileSummary('')

    try {
      const res = await fetch('/api/admin/naver-orders/reconcile', {
        method: 'POST',
        headers: headers(),
      })
      const data = await res.json()

      if (!res.ok) {
        setReconcileError(typeof data.error === 'string' ? data.error : '대조 실패')
        return
      }

      setForgery((data.forgery as SuspectOrderRow[]) ?? [])
      setDuplicate((data.duplicate as SuspectOrderRow[]) ?? [])
      setReconcileSummary(
        typeof data.summary === 'string'
          ? data.summary
          : `위조 의심 ${data.forgery_count ?? 0}건 · 중복 사용 ${data.duplicate_count ?? 0}건`
      )
      void loadAttempts()
    } catch {
      setReconcileError('대조 중 오류가 발생했어요')
    } finally {
      setReconciling(false)
    }
  }

  async function handleRevoke(orderId: string) {
    if (!window.confirm('이 주문번호 인증을 취소할까요? (해당 주문 행이 삭제됩니다)')) {
      return
    }

    setRevokingId(orderId)
    setReconcileError('')

    try {
      const res = await fetch('/api/admin/naver-orders/revoke', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setReconcileError(typeof data.error === 'string' ? data.error : '인증 취소 실패')
        return
      }

      setForgery(prev => prev.filter(row => row.order_id !== orderId))
      setDuplicate(prev => prev.filter(row => row.order_id !== orderId))
    } catch {
      setReconcileError('인증 취소 중 오류가 발생했어요')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          네이버 판매자센터에서 다운로드한 주문내역 엑셀(.xlsx)을 업로드하세요.
          <br />
          맨 왼쪽(또는 &quot;상품주문번호&quot;) 컬럼을 읽어 실제 주문 목록에 저장합니다.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className="label-field">엑셀 파일 (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={uploading}
              className="input-field"
              onChange={e => {
                setSelectedFile(e.target.files?.[0] ?? null)
                setUploadError('')
                setUploadResult(null)
              }}
            />
          </label>
          <button
            type="button"
            className="btn-primary-inline shrink-0"
            disabled={uploading || !selectedFile}
            onClick={() => void handleUpload()}
          >
            {uploading ? '업로드 중...' : 'UPLOAD'}
          </button>
        </div>

        {selectedFile ? (
          <p className="text-sm text-muted">
            선택: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        ) : null}

        {uploadError ? <p className="alert-danger mb-0">{uploadError}</p> : null}

        {uploadResult ? (
          <div className="alert-success mb-0">
            <p className="mb-1 font-semibold">{uploadResult.summary}</p>
            <p className="mb-0 text-sm">
              파일: {uploadResult.file_name}
              <br />
              추출 {uploadResult.total_parsed.toLocaleString('ko-KR')}건 · 신규{' '}
              {uploadResult.new_count.toLocaleString('ko-KR')}건 · 기존 갱신{' '}
              {uploadResult.updated_count.toLocaleString('ko-KR')}건
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-5">
        <h4 className="text-sm font-semibold text-[var(--text)]">주문번호 대조 · 의심 계정</h4>
        <p className="text-sm text-muted">
          형식 검증만으로 통과된 주문번호를 업로드된 실주문 목록과 대조합니다.
          <br />
          <span className="text-[var(--primary)]">위조 의심</span>: 목록에 없음 ·{' '}
          <span className="text-[var(--primary)]">중복 사용</span>: 목록에는 있으나 다른 계정이 먼저
          인증
        </p>

        <button
          type="button"
          className="btn-primary-inline"
          disabled={reconciling}
          onClick={() => void handleReconcile()}
        >
          {reconciling ? '대조 중...' : '주문번호 대조 실행'}
        </button>

        {reconcileError ? <p className="alert-danger mb-0">{reconcileError}</p> : null}
        {reconcileSummary ? (
          <p className="alert-success mb-0 text-sm font-semibold">{reconcileSummary}</p>
        ) : null}

        <SuspectSection
          title="위조 의심"
          emptyText="위조 의심 주문이 없어요."
          rows={forgery}
          revokingId={revokingId}
          onRevoke={handleRevoke}
          showFirstUser={false}
        />

        <SuspectSection
          title="중복 사용"
          emptyText="중복 사용 주문이 없어요."
          rows={duplicate}
          revokingId={revokingId}
          onRevoke={handleRevoke}
          showFirstUser
        />
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[var(--text)]">
            중복 제출 시도 로그{' '}
            <span className="font-normal text-muted">
              ({attempts.length.toLocaleString('ko-KR')})
            </span>
          </h4>
          <button
            type="button"
            className="btn-secondary-inline px-3 py-1.5 text-xs"
            disabled={attemptsLoading}
            onClick={() => void loadAttempts()}
          >
            {attemptsLoading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
        <p className="text-sm text-muted">
          다른 계정이 이미 쓴 주문번호로 인증을 시도했을 때 기록됩니다. (권한/연장은 부여되지 않음)
        </p>

        {attemptsError ? <p className="alert-danger mb-0">{attemptsError}</p> : null}

        {!attemptsError && attempts.length === 0 && !attemptsLoading ? (
          <p className="text-sm text-muted">최근 중복 시도 기록이 없어요.</p>
        ) : null}

        {attempts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-muted">
                  <th className="py-2 pr-3 font-medium">시도 시각</th>
                  <th className="py-2 pr-3 font-medium">시도한 사용자</th>
                  <th className="py-2 pr-3 font-medium">주문번호</th>
                  <th className="py-2 font-medium">플랫폼</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(row => (
                  <tr key={row.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3">{formatWhen(row.created_at)}</td>
                    <td className="py-2 pr-3">
                      <p className="font-medium">
                        {row.user_email || row.user_id?.slice(0, 8) || '-'}
                      </p>
                      {row.user_id ? (
                        <p className="font-mono text-xs text-muted">{row.user_id.slice(0, 8)}…</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.order_number}</td>
                    <td className="py-2">{row.platform || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SuspectSection({
  title,
  emptyText,
  rows,
  revokingId,
  onRevoke,
  showFirstUser,
}: {
  title: string
  emptyText: string
  rows: SuspectOrderRow[]
  revokingId: string | null
  onRevoke: (orderId: string) => void
  showFirstUser: boolean
}) {
  return (
    <section className="space-y-2">
      <h5 className="text-sm font-semibold">
        {title}{' '}
        <span className="font-normal text-muted">({rows.length.toLocaleString('ko-KR')})</span>
      </h5>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-muted">
                <th className="py-2 pr-3 font-medium">사용자</th>
                <th className="py-2 pr-3 font-medium">주문번호</th>
                <th className="py-2 pr-3 font-medium">인증 시각</th>
                {showFirstUser ? (
                  <th className="py-2 pr-3 font-medium">먼저 인증한 계정</th>
                ) : null}
                <th className="py-2 font-medium">처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.order_id} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted">{row.email}</p>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.order_number}</td>
                  <td className="py-2 pr-3">{formatWhen(row.verified_at)}</td>
                  {showFirstUser ? (
                    <td className="py-2 pr-3">
                      <p className="font-medium">{row.first_name ?? row.first_email ?? '-'}</p>
                      <p className="text-xs text-muted">{row.first_email}</p>
                      <p className="text-xs text-muted">{formatWhen(row.first_verified_at)}</p>
                    </td>
                  ) : null}
                  <td className="py-2">
                    <button
                      type="button"
                      className="btn-danger-inline px-3 py-1.5 text-xs"
                      disabled={revokingId === row.order_id}
                      onClick={() => onRevoke(row.order_id)}
                    >
                      {revokingId === row.order_id ? '처리 중...' : '인증 취소'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
