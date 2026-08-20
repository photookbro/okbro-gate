'use client'

import { useCallback, useEffect, useState } from 'react'

type DashboardMetrics = {
  total_signups: number
  purchase_verifications_total: number
  instagram_follow_verifications_total: number
  dau: number | null
  dau_note: string
  return_visit_rate_percent: number | null
  return_visit_this_week_active: number
  return_visit_returning_users: number
  return_visit_note: string
  vercel_analytics_url: string
}

type AdminDashboardPanelProps = {
  token: string
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div
      className="rounded-lg px-6 py-4"
      style={{ background: '#0d0d0d', border: '1px solid #222' }}
    >
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className="text-3xl font-bold" style={{ color: '#FF2800' }}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function AdminDashboardPanel({ token }: AdminDashboardPanelProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dashboard-metrics', {
        headers: { 'x-admin-token': token },
      })
      const data = (await res.json()) as DashboardMetrics & { error?: string }
      if (!res.ok) {
        setError(data.error ?? '지표를 불러오지 못했어요')
        setMetrics(null)
        return
      }
      setMetrics(data)
    } catch {
      setError('지표를 불러오지 못했어요')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return <p className="text-muted">로딩 중...</p>
  }

  if (error) {
    return (
      <>
        <p className="alert-danger">{error}</p>
        <button type="button" onClick={() => void load()} className="btn-secondary-inline mt-3">
          다시 불러오기
        </button>
      </>
    )
  }

  if (!metrics) return null

  const dauValue =
    metrics.dau === null ? '—' : metrics.dau.toLocaleString('ko-KR')
  const returnValue =
    metrics.return_visit_rate_percent === null
      ? '—'
      : `${metrics.return_visit_rate_percent.toLocaleString('ko-KR')}%`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <KpiCard
          label="전체 회원수"
          value={metrics.total_signups.toLocaleString('ko-KR')}
        />
        <KpiCard
          label="구매 인증 누적"
          value={metrics.purchase_verifications_total.toLocaleString('ko-KR')}
          hint="orders 테이블 전체 건수"
        />
        <KpiCard
          label="인스타 팔로우 인증 누적"
          value={metrics.instagram_follow_verifications_total.toLocaleString('ko-KR')}
          hint="승인(approved) 건수"
        />
        <KpiCard label="DAU (오늘)" value={dauValue} hint={metrics.dau_note} />
        <KpiCard
          label="재방문율 (이번 주)"
          value={returnValue}
          hint={`${metrics.return_visit_returning_users.toLocaleString('ko-KR')} / ${metrics.return_visit_this_week_active.toLocaleString('ko-KR')}명 · ${metrics.return_visit_note}`}
        />
      </div>

      <section className="card-section">
        <h3 className="mb-2 text-base font-semibold text-[var(--text)]">페이지뷰 · 트래픽</h3>
        <p className="text-sm leading-relaxed text-muted">
          페이지뷰와 방문 트래픽은 Vercel Analytics 대시보드에서 확인하세요. (자체 차트 없음)
        </p>
        <a
          href={metrics.vercel_analytics_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary-inline mt-4 inline-flex no-underline"
        >
          Vercel Analytics 열기 ↗
        </a>
      </section>
    </div>
  )
}
