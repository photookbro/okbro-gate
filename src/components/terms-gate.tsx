'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TermsAgreement } from '@/components/terms-agreement'
import { useGuestAuth } from '@/components/guest-auth-gate'
import {
  clearLocalTermsAgreed,
  fetchTermsAgreementStatus,
  setTermsAgreed,
} from '@/lib/terms-agreement'
import { isGuestClickExemptPath } from '@/lib/guest-routes'

type GateStatus = 'idle' | 'checking' | 'required' | 'passed'

export function TermsGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoggedIn, authReady } = useGuestAuth()
  const [status, setStatus] = useState<GateStatus>('idle')
  /** 이 브라우저 탭 세션(새로고침 전)에서 서버 동의 확인을 통과했는지 */
  const sessionVerifiedPassedRef = useRef(false)

  const exempt = isGuestClickExemptPath(pathname)

  useEffect(() => {
    if (!isLoggedIn) {
      sessionVerifiedPassedRef.current = false
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!authReady) return

    if (exempt || !isLoggedIn) {
      setStatus('passed')
      return
    }

    // 세션 중 이미 서버에서 동의 확인됨 → 탭 전환·라우트 이동 시 재검증/로딩 없음
    if (sessionVerifiedPassedRef.current) {
      setStatus('passed')
      return
    }

    let cancelled = false
    setStatus('checking')

    void (async () => {
      const result = await fetchTermsAgreementStatus()
      if (cancelled) return
      if (result.agreed) {
        setTermsAgreed()
        sessionVerifiedPassedRef.current = true
        setStatus('passed')
      } else {
        clearLocalTermsAgreed()
        setStatus('required')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, isLoggedIn, exempt])

  if (!authReady || (isLoggedIn && !exempt && (status === 'idle' || status === 'checking'))) {
    return (
      <div className="page-shell flex min-h-[60vh] items-center justify-center">
        <p className="text-muted">이용 안내 확인 중...</p>
      </div>
    )
  }

  if (isLoggedIn && !exempt && status === 'required') {
    return (
      <TermsAgreement
        visible
        mode="page"
        onComplete={() => {
          setTermsAgreed()
          sessionVerifiedPassedRef.current = true
          setStatus('passed')
        }}
      />
    )
  }

  return <>{children}</>
}
