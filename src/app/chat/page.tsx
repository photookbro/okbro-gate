'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** 예전 /chat 링크 → 마이페이지 채팅 섹션으로 이동 */
export default function ChatRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/mypage#chat')
  }, [router])

  return (
    <div className="page-shell mypage-page flex items-center justify-center">
      <p className="text-muted">마이페이지로 이동 중...</p>
    </div>
  )
}
