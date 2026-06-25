'use client'

import { createContext, useContext } from 'react'
import { clearAdminSession } from '@/lib/admin-auth-client'

const AdminAuthContext = createContext<{ token: string; logout: () => void } | null>(null)

export function AdminAuthProvider({
  token,
  children,
}: {
  token: string
  children: React.ReactNode
}) {
  function logout() {
    clearAdminSession()
    window.location.href = '/admin'
  }

  return (
    <AdminAuthContext.Provider value={{ token, logout }}>{children}</AdminAuthContext.Provider>
  )
}

export function useAdminToken() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx?.token) {
    throw new Error('useAdminToken must be used within AdminAuthProvider')
  }
  return ctx.token
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return ctx
}

export { ADMIN_TOKEN_KEY } from '@/lib/admin-auth-client'
