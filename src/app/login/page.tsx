'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getExternalBrowserInstructions,
  isInAppBrowser,
  openInExternalBrowser,
} from '@/lib/in-app-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState(false)

  useEffect(() => {
    setInAppBrowser(isInAppBrowser())
  }, [])

  async function handleLogin() {
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      alert('오류: ' + error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    if (inAppBrowser) {
      const proceed = confirm(
        '앱 내 브라우저에서는 구글 로그인이 차단될 수 있어요.\nSafari 또는 Chrome에서 열어주세요.\n\n그래도 시도할까요?'
      )
      if (!proceed) return
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '360px', width: '100%' }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏅📸</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>오켱GATE</h1>
        {sent ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              이메일로 로그인 링크를 보냈어요!
              <br />
              메일함 확인해주세요 😊
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              이메일로 로그인 링크를 받으세요
            </p>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="이메일 입력"
              type="email"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '0.95rem',
                outline: 'none',
                marginBottom: '0.75rem',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                marginBottom: '0.75rem',
              }}
            >
              {loading ? '전송 중...' : '📧 이메일로 로그인'}
            </button>

            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                border: inAppBrowser ? '1px solid #fde68a' : '1px solid var(--border)',
                backgroundColor: inAppBrowser ? '#fffbeb' : '#f9fafb',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  margin: '0 0 0.35rem',
                  color: inAppBrowser ? '#92400e' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                }}
              >
                카카오톡, 인스타그램 등 앱 내 브라우저에서는 구글 로그인이 안 됩니다.
              </p>
              <p
                style={{
                  margin: 0,
                  color: inAppBrowser ? '#92400e' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  fontWeight: inAppBrowser ? 600 : 400,
                }}
              >
                Safari 또는 Chrome 브라우저로 열어주세요.
              </p>
              {inAppBrowser && (
                <p
                  style={{
                    margin: '0.5rem 0 0',
                    color: '#b45309',
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                  }}
                >
                  {getExternalBrowserInstructions()}
                </p>
              )}
            </div>

            {inAppBrowser && (
              <button
                type="button"
                onClick={() => openInExternalBrowser()}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginBottom: '0.75rem',
                }}
              >
                🌐 외부 브라우저로 열기
              </button>
            )}

            <button
              onClick={handleGoogleLogin}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: 'white',
                color: '#333',
                border: '1px solid var(--border)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                opacity: inAppBrowser ? 0.6 : 1,
              }}
            >
              🔵 구글 로그인
            </button>
          </>
        )}
      </div>
    </div>
  )
}
