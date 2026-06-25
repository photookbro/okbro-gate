export const ADMIN_TOKEN_KEY = 'admin_token'

export async function validateAdminToken(token: string): Promise<boolean> {
  const trimmed = token.trim()
  if (!trimmed) return false

  try {
    const res = await fetch('/api/admin/settings', {
      headers: { 'x-admin-token': trimmed },
    })
    return res.ok
  } catch {
    return false
  }
}

export function clearAdminSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function readAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveAdminToken(token: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim())
}
