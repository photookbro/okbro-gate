'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** 예전 /chat · /mypage#chat 링크 → 문의 안내로 이동 */
export default function ChatRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/mypage#contact')
  }, [router])

  return (
    <div className="page-shell flex items-center justify-center">
      <p className="text-muted">문의 안내로 이동 중...</p>
    </div>
  )
}
