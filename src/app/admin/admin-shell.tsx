'use client'

import { useEffect, useState } from 'react'
import { AdminAuthProvider } from './admin-auth-context'
import { AdminHeader } from '@/components/admin/admin-header'
import {
  readAdminToken,
  saveAdminToken,
  validateAdminToken,
  clearAdminSession,
} from '@/lib/admin-auth-client'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const saved = readAdminToken()
      if (!saved) {
        if (!cancelled) setChecked(true)
        return
      }

      const valid = await validateAdminToken(saved)
      if (cancelled) return

      if (valid) {
        setToken(saved)
      } else {
        clearAdminSession()
      }
      setChecked(true)
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = password.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')

    try {
      const valid = await validateAdminToken(trimmed)
      if (!valid) {
        setError('비밀번호가 올바르지 않아요')
        return
      }

      saveAdminToken(trimmed)
      setToken(trimmed)
      setPassword('')
    } catch {
      setError('인증 중 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  if (!checked) {
    return (
      <div className="admin-auth-screen">
        <p className="text-muted">잠시만 기다리세요. 관리자 인증을 확인하고 있습니다.</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="admin-auth-screen">
        <form onSubmit={handleLogin} className="admin-auth-card">
          <p className="admin-auth-badge">오켱 ADMIN</p>
          <h1 className="admin-auth-title">관리자 로그인</h1>
          <p className="admin-auth-subtitle">관리자 비밀번호를 입력해주세요</p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoFocus
            autoComplete="current-password"
            className="input-field mb-3"
          />
          {error ? <p className="alert-danger mb-3">{error}</p> : null}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '확인 중...' : '입장'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <AdminAuthProvider token={token}>
      <div className="admin-app-shell">
        <AdminHeader />
        {children}
      </div>
    </AdminAuthProvider>
  )
}
