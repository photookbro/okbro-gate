'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_GUIDE_CONSENT_LABELS,
  DEFAULT_GUIDE_FONT_SIZE,
  GUIDE_FONT_SIZE_PRESETS,
  type GuideContentBlock,
  ONBOARDING_GUIDE_CONSENT_KEY,
  createDefaultGuideBlocks,
  normalizeGuideConsentLabels,
  parseGuideContentBlocks,
} from '@/lib/app-content'

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
  const [blocks, setBlocks] = useState<GuideContentBlock[]>(createDefaultGuideBlocks)
  const [consentLabel1, setConsentLabel1] = useState(DEFAULT_GUIDE_CONSENT_LABELS[0])
  const [consentLabel2, setConsentLabel2] = useState(DEFAULT_GUIDE_CONSENT_LABELS[1])
  const [consentLabel3, setConsentLabel3] = useState(DEFAULT_GUIDE_CONSENT_LABELS[2])
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
      const nextBlocks = Array.isArray(data.blocks)
        ? (data.blocks as GuideContentBlock[])
        : parseGuideContentBlocks(data.content)
      setBlocks(nextBlocks.length > 0 ? nextBlocks : createDefaultGuideBlocks())
      const labels = normalizeGuideConsentLabels(data)
      setConsentLabel1(labels.consent_label_1)
      setConsentLabel2(labels.consent_label_2)
      setConsentLabel3(labels.consent_label_3)
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

  function updateBlock(index: number, patch: Partial<GuideContentBlock>) {
    setBlocks(prev => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }

  function addBlock() {
    setBlocks(prev => [...prev, { text: '', font_size: DEFAULT_GUIDE_FONT_SIZE }])
  }

  function removeBlock(index: number) {
    setBlocks(prev => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

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
          blocks,
          consent_label_1: consentLabel1,
          consent_label_2: consentLabel2,
          consent_label_3: consentLabel3,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '저장에 실패했어요')
        return
      }
      const nextBlocks = Array.isArray(data.blocks)
        ? (data.blocks as GuideContentBlock[])
        : parseGuideContentBlocks(data.content)
      setBlocks(nextBlocks.length > 0 ? nextBlocks : createDefaultGuideBlocks())
      const labels = normalizeGuideConsentLabels(data)
      setConsentLabel1(labels.consent_label_1)
      setConsentLabel2(labels.consent_label_2)
      setConsentLabel3(labels.consent_label_3)
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
        본문은 블록 단위로 편집해요. 블록마다 마크다운과 폰트 크기를 따로 둘 수 있어요.
      </p>
      <p className="mb-3 text-xs text-muted">최종 수정: {formatUpdatedAt(updatedAt)}</p>

      <div className="mb-4 flex flex-col gap-3">
        {blocks.map((block, index) => (
          <div key={index} className="card-section">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">블록 {index + 1}</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted">폰트</span>
                  <select
                    value={block.font_size}
                    onChange={e => updateBlock(index, { font_size: Number(e.target.value) })}
                    className="input-field py-1"
                  >
                    {GUIDE_FONT_SIZE_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => removeBlock(index)}
                  disabled={blocks.length <= 1}
                  className="btn-secondary-inline px-2.5 py-1.5 text-sm"
                >
                  블록 삭제
                </button>
              </div>
            </div>
            <textarea
              value={block.text}
              onChange={e => updateBlock(index, { text: e.target.value })}
              rows={10}
              className="input-field font-mono text-sm leading-relaxed"
              spellCheck={false}
              style={{ fontSize: `${block.font_size}px` }}
            />
          </div>
        ))}
      </div>

      <div className="mb-4">
        <button type="button" onClick={addBlock} className="btn-secondary-inline">
          + 블록 추가
        </button>
      </div>

      <label className="mb-3 block">
        <span className="label-field">동의 체크박스 1</span>
        <input
          type="text"
          value={consentLabel1}
          onChange={e => setConsentLabel1(e.target.value)}
          className="input-field"
          maxLength={500}
          required
        />
      </label>

      <label className="mb-3 block">
        <span className="label-field">동의 체크박스 2</span>
        <input
          type="text"
          value={consentLabel2}
          onChange={e => setConsentLabel2(e.target.value)}
          className="input-field"
          maxLength={500}
          required
        />
      </label>

      <label className="mb-3 block">
        <span className="label-field">동의 체크박스 3</span>
        <input
          type="text"
          value={consentLabel3}
          onChange={e => setConsentLabel3(e.target.value)}
          className="input-field"
          maxLength={500}
          required
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
