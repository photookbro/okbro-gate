'use client'

import { createContext, useContext } from 'react'

const AdminAuthContext = createContext<string | null>(null)

export function AdminAuthProvider({
  token,
  children,
}: {
  token: string
  children: React.ReactNode
}) {
  return <AdminAuthContext.Provider value={token}>{children}</AdminAuthContext.Provider>
}

export function useAdminToken() {
  const token = useContext(AdminAuthContext)
  if (!token) {
    throw new Error('useAdminToken must be used within AdminAuthProvider')
  }
  return token
}

export const ADMIN_TOKEN_KEY = 'admin_token'
