'use client'

import { useEffect, useState } from 'react'
import { copyCurrentPageUrl, detectInAppBrowser } from '@/lib/in-app-browser'

const INSTRUCTIONS = [
  { label: '카카오톡', text: '우측 하단 ... → 브라우저로 열기' },
  { label: '인스타그램', text: '우측 하단 ... → 외부 브라우저로 열기' },
  { label: '기타', text: '주소를 복사해서 Chrome 또는 Safari에서 열기' },
]

export function InappBrowserWarning() {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setShow(detectInAppBrowser() !== null)
  }, [])

  async function handleCopyUrl() {
    const success = await copyCurrentPageUrl()
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } else {
      window.prompt('아래 주소를 복사해서 Chrome 또는 Safari에서 열어주세요:', window.location.href)
    }
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#111827',
            margin: '0 0 0.75rem',
            lineHeight: 1.4,
          }}
        >
          📱 외부 브라우저에서 열어주세요
        </h1>
        <p
          style={{
            color: '#6b7280',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            margin: '0 0 1.25rem',
          }}
        >
          카카오톡, 인스타그램 등 앱 내에서는 구글 로그인이 제한됩니다.
        </p>

        <div
          style={{
            textAlign: 'left',
            marginBottom: '1.25rem',
            padding: '1rem',
            borderRadius: '10px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
          }}
        >
          <p
            style={{
              margin: '0 0 0.75rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            아래 방법으로 외부 브라우저에서 열어주세요:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.1rem',
              color: '#4b5563',
              fontSize: '0.85rem',
              lineHeight: 1.7,
            }}
          >
            {INSTRUCTIONS.map(item => (
              <li key={item.label} style={{ marginBottom: '0.35rem' }}>
                <strong style={{ color: '#111827' }}>{item.label}</strong>: {item.text}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={handleCopyUrl}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: copied ? '#16a34a' : '#2563eb',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {copied ? '✅ 주소 복사됨!' : '📋 현재 URL 복사하기'}
        </button>
      </div>
    </div>
  )
}
