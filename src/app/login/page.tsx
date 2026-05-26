'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleLogin() {
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '360px', width: '100%' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏅📸</div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>오켱GATE</h1>
        {sent ? (
          <div>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              이메일로 로그인 링크를 보냈어요!<br />
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
                width: '100%', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '0.95rem', outline: 'none',
                marginBottom: '0.75rem',
              }}
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: 'var(--accent)', color: 'white', border: 'none',
                fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                marginBottom: '0.75rem',
              }}
            >
              {loading ? '전송 중...' : '📧 이메일로 로그인'}
            </button>
            <button
              onClick={handleGoogleLogin}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: 'white', color: '#333', border: '1px solid var(--border)',
                fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
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