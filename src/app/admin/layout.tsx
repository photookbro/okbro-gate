'use client'

import { useEffect, useState } from 'react'
import { AdminAuthProvider, ADMIN_TOKEN_KEY } from './admin-auth-context'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '1rem',
}

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
  padding: '1.75rem',
  width: '100%',
  maxWidth: '360px',
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '0.95rem',
  outline: 'none',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (saved) setToken(saved)
    setChecked(true)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'x-admin-token': password.trim() },
      })

      if (!res.ok) {
        setError('비밀번호가 올바르지 않아요')
        setLoading(false)
        return
      }

      sessionStorage.setItem(ADMIN_TOKEN_KEY, password.trim())
      setToken(password.trim())
      setPassword('')
      setLoading(false)
    } catch {
      setError('인증 중 오류가 발생했어요')
      setLoading(false)
    }
  }

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280' }}>로딩 중...</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div style={overlayStyle}>
        <form onSubmit={handleLogin} style={modalStyle}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem', textAlign: 'center' }}>
            🔐 관리자 로그인
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem', textAlign: 'center' }}>
            관리자 비밀번호를 입력해주세요
          </p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <AdminAuthProvider token={token}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>{children}</div>
    </AdminAuthProvider>
  )
}
