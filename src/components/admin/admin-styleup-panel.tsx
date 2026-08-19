'use client'

const ENHANCE_ADMIN_SRC = '/photo-enhance.html#admin'

export function AdminStyleupPanel() {
  return (
    <div className="admin-styleup-wrap">
      <iframe
        src={ENHANCE_ADMIN_SRC}
        title="STYLEUP 관리"
        className="admin-styleup-frame"
        allow="clipboard-write"
      />
    </div>
  )
}
