'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const exempt = isGuestClickExemptPath(pathname)

  const verifyTermsFromServer = useCallback(async () => {
    const result = await fetchTermsAgreementStatus()
    if (result.agreed) {
      setTermsAgreed()
      setStatus('passed')
      return true
    }
    clearLocalTermsAgreed()
    setStatus('required')
    return false
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (exempt || !isLoggedIn) {
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
        setStatus('passed')
      } else {
        clearLocalTermsAgreed()
        setStatus('required')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, isLoggedIn, exempt, pathname])

  // PWA/오래된 탭: 포커스·가시성 복귀 시 서버 재검증 (localStorage만 믿지 않음)
  useEffect(() => {
    if (!authReady || !isLoggedIn || exempt) return

    function recheck() {
      void verifyTermsFromServer()
    }

    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') recheck()
    })

    return () => {
      window.removeEventListener('focus', recheck)
    }
  }, [authReady, isLoggedIn, exempt, verifyTermsFromServer])

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
          setStatus('passed')
        }}
      />
    )
  }

  return <>{children}</>
}
