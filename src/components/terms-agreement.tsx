'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { saveTermsAgreement } from '@/lib/terms-agreement'
import {
  ONBOARDING_GUIDE_CONSENT_FALLBACK,
  ONBOARDING_GUIDE_CONSENT_KEY,
} from '@/lib/app-content'

type TermsAgreementProps = {
  visible: boolean
  onComplete: () => void
  onClose?: () => void
  mode?: 'modal' | 'page'
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
  marginTop: '0.5rem',
  cursor: 'pointer',
}

const CHECKBOXES = [
  {
    id: 'section1',
    label: '링크 공유 금지 및 타인 사진 다운로드 금지에 동의합니다',
  },
  {
    id: 'section2',
    label: '내용을 확인했습니다',
  },
  {
    id: 'section3',
    label: '촬영 및 저작권 안내를 확인했습니다',
  },
] as const

export function TermsAgreement({
  visible,
  onComplete,
  onClose,
  mode = 'modal',
}: TermsAgreementProps) {
  const [section1, setSection1] = useState(false)
  const [section2, setSection2] = useState(false)
  const [section3, setSection3] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [guideMarkdown, setGuideMarkdown] = useState(ONBOARDING_GUIDE_CONSENT_FALLBACK)
  const [guideLoading, setGuideLoading] = useState(true)

  useEffect(() => {
    if (visible) {
      setSection1(false)
      setSection2(false)
      setSection3(false)
      setSubmitError('')
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    setGuideLoading(true)

    void (async () => {
      try {
        const res = await fetch(
          `/api/app-content?key=${encodeURIComponent(ONBOARDING_GUIDE_CONSENT_KEY)}`
        )
        const data = await res.json()
        if (!cancelled && typeof data.content === 'string' && data.content.trim()) {
          setGuideMarkdown(data.content)
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setGuideLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [visible])

  if (!visible) return null

  const checkedMap = { section1, section2, section3 }
  const setCheckedMap = {
    section1: setSection1,
    section2: setSection2,
    section3: setSection3,
  }
  const allChecked = section1 && section2 && section3
  const isPage = mode === 'page'

  async function handleSubmit() {
    if (!allChecked || submitting) return

    setSubmitting(true)
    setSubmitError('')

    const result = await saveTermsAgreement()

    setSubmitting(false)

    if (!result.success) {
      setSubmitError(result.error ?? '동의 기록 저장 실패')
      return
    }

    onComplete()
  }

  function handleBackdropClick() {
    onClose?.()
  }

  const content = (
    <>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.35rem' }}>
        이용 안내 및 동의
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        앨범 이용 전 아래 내용을 확인해 주세요.
      </p>

      {guideLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>불러오는 중...</p>
      ) : (
        <div className="terms-guide-markdown" style={{ marginBottom: '1.25rem' }}>
          <ReactMarkdown>{guideMarkdown}</ReactMarkdown>
        </div>
      )}

      <div
        style={{
          marginBottom: '1rem',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg)',
        }}
      >
        {CHECKBOXES.map(box => (
          <label key={box.id} style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={checkedMap[box.id]}
              onChange={e => setCheckedMap[box.id](e.target.checked)}
              style={{ marginTop: '0.2rem', flexShrink: 0 }}
            />
            <span style={{ color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
              {box.label}
            </span>
          </label>
        ))}
      </div>

      {submitError && (
        <p
          style={{
            color: '#ff6b52',
            fontSize: '0.8rem',
            margin: '0 0 0.75rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--color-danger-bg)',
            borderRadius: '6px',
            border: '1px solid var(--color-danger-border)',
          }}
        >
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!allChecked || submitting}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: allChecked && !submitting ? 'var(--primary)' : 'var(--disabled)',
          color: '#ffffff',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? '저장 중...' : isPage ? '동의하고 계속하기' : '사진 보러가기 →'}
      </button>
    </>
  )

  if (isPage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', padding: '2rem 1rem' }}>
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            padding: '1.5rem',
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
          padding: '1.5rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
