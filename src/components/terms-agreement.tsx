'use client'

import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { saveTermsAgreement } from '@/lib/terms-agreement'
import {
  DEFAULT_GUIDE_CONSENT_LABELS,
  type GuideContentBlock,
  ONBOARDING_GUIDE_CONSENT_KEY,
  createDefaultGuideBlocks,
  normalizeGuideConsentLabels,
  parseGuideContentBlocks,
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

class GuideMarkdownBoundary extends Component<
  { children: ReactNode; fallbackText: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallbackText: string }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[terms-agreement] markdown render failed', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <p style={{ color: '#ffffff', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {this.props.fallbackText}
        </p>
      )
    }
    return this.props.children
  }
}

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
  const [blocks, setBlocks] = useState<GuideContentBlock[]>(createDefaultGuideBlocks)
  const [consentLabels, setConsentLabels] = useState({
    consent_label_1: DEFAULT_GUIDE_CONSENT_LABELS[0],
    consent_label_2: DEFAULT_GUIDE_CONSENT_LABELS[1],
    consent_label_3: DEFAULT_GUIDE_CONSENT_LABELS[2],
  })
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
        if (cancelled) return
        const nextBlocks = Array.isArray(data.blocks)
          ? (data.blocks as GuideContentBlock[])
          : parseGuideContentBlocks(data.content)
        setBlocks(nextBlocks.length > 0 ? nextBlocks : createDefaultGuideBlocks())
        setConsentLabels(normalizeGuideConsentLabels(data))
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

  const allChecked = section1 && section2 && section3
  const isPage = mode === 'page'
  const checkboxes = [
    {
      id: 'section1' as const,
      label: consentLabels.consent_label_1,
      checked: section1,
      onChange: setSection1,
    },
    {
      id: 'section2' as const,
      label: consentLabels.consent_label_2,
      checked: section2,
      onChange: setSection2,
    },
    {
      id: 'section3' as const,
      label: consentLabels.consent_label_3,
      checked: section3,
      onChange: setSection3,
    },
  ]

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
    <div className="terms-agreement-content">
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.35rem' }}>
        이용 안내 및 동의
      </h2>
      <p style={{ color: '#ffffff', fontSize: '0.85rem', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        앨범 이용 전 아래 내용을 확인해 주세요.
      </p>

      {guideLoading ? (
        <p style={{ color: '#ffffff', fontSize: '0.85rem', margin: '0 0 1rem' }}>불러오는 중...</p>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          {blocks.map((block, index) => (
            <GuideMarkdownBoundary key={index} fallbackText={typeof block.text === 'string' ? block.text : ''}>
              <div
                className="terms-guide-markdown"
                style={{
                  fontSize: `${Number.isFinite(block.font_size) ? block.font_size : 16}px`,
                  marginBottom: index === blocks.length - 1 ? 0 : '0.85rem',
                }}
              >
                <ReactMarkdown>{typeof block.text === 'string' ? block.text : ''}</ReactMarkdown>
              </div>
            </GuideMarkdownBoundary>
          ))}
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
        {checkboxes.map((box, index) => (
          <label key={box.id} style={{ ...checkboxRowStyle, marginTop: index === 0 ? 0 : '0.5rem' }}>
            <input
              type="checkbox"
              checked={box.checked}
              onChange={e => box.onChange(e.target.checked)}
              style={{ marginTop: '0.2rem', flexShrink: 0 }}
            />
            <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.5 }}>
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
    </div>
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
