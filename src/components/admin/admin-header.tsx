'use client'

import { useAdminAuth } from '@/app/admin/admin-auth-context'

export function AdminHeader() {
  const { logout } = useAdminAuth()

  return (
    <header className="admin-app-header">
      <div className="admin-app-header-inner">
        <div>
          <p className="admin-app-header-label">오켱 ADMIN</p>
          <p className="admin-app-header-desc">관리자 전용 앱</p>
        </div>
        <button type="button" onClick={logout} className="admin-logout-btn">
          로그아웃
        </button>
      </div>
    </header>
  )
}
