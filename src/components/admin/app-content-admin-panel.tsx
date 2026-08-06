'use client'

import { useCallback, useEffect, useState } from 'react'
import { ONBOARDING_GUIDE_CONSENT_KEY } from '@/lib/app-content'

type AppContentAdminPanelProps = {
  token: string
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '아직 저장되지 않음'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AppContentAdminPanel({ token }: AppContentAdminPanelProps) {
  const [content, setContent] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const adminFetch = useCallback(
    (url: string, options: RequestInit = {}) =>
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
          ...options.headers,
        },
      }),
    [token]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminFetch(
        `/api/admin/app-content?key=${encodeURIComponent(ONBOARDING_GUIDE_CONSENT_KEY)}`
      )
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '불러오지 못했어요')
        return
      }
      setContent(typeof data.content === 'string' ? data.content : '')
      setUpdatedAt(typeof data.updated_at === 'string' ? data.updated_at : null)
    } catch {
      setError('불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await adminFetch('/api/admin/app-content', {
        method: 'PUT',
        body: JSON.stringify({
          key: ONBOARDING_GUIDE_CONSENT_KEY,
          content,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '저장에 실패했어요')
        return
      }
      setContent(typeof data.content === 'string' ? data.content : content)
      setUpdatedAt(typeof data.updated_at === 'string' ? data.updated_at : null)
      setMessage('저장했어요')
    } catch {
      setError('저장에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-muted">로딩 중...</p>
  }

  return (
    <form onSubmit={handleSave}>
      <p className="mb-3 text-sm text-muted">
        온보딩 「이용 안내 및 동의」 본문이에요. 마크다운을 쓸 수 있어요. (제목 ##, 목록 -, 강조 인용문
        &gt;)
      </p>
      <p className="mb-3 text-xs text-muted">최종 수정: {formatUpdatedAt(updatedAt)}</p>

      <label className="mb-3 block">
        <span className="label-field">본문 (마크다운)</span>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={22}
          className="input-field font-mono text-sm leading-relaxed"
          spellCheck={false}
        />
      </label>

      {error && <p className="alert-danger">{error}</p>}
      {message && <p className="alert-success">{message}</p>}

      <button type="submit" disabled={saving} className="btn-primary-inline">
        {saving ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}
