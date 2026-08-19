'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TermsAgreement } from '@/components/terms-agreement'
import { useGuestAuth } from '@/components/guest-auth-gate'
import { fetchTermsAgreementStatus, hasTermsAgreed, setTermsAgreed } from '@/lib/terms-agreement'
import { isGuestClickExemptPath } from '@/lib/guest-routes'

type GateStatus = 'idle' | 'checking' | 'required' | 'passed'

export function TermsGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isLoggedIn, authReady } = useGuestAuth()
  const [status, setStatus] = useState<GateStatus>('idle')
  const [serverChecked, setServerChecked] = useState(false)

  const exempt = isGuestClickExemptPath(pathname)

  useEffect(() => {
    if (!authReady) return
    if (exempt || !isLoggedIn) {
      setStatus('passed')
      return
    }

    if (hasTermsAgreed()) {
      setStatus('passed')
      if (serverChecked) return

      let cancelled = false
      void (async () => {
        const result = await fetchTermsAgreementStatus()
        if (cancelled) return
        setServerChecked(true)
        if (!result.agreed) {
          setStatus('required')
        }
      })()
      return () => { cancelled = true }
    }

    let cancelled = false
    setStatus('checking')

    void (async () => {
      const result = await fetchTermsAgreementStatus()
      if (cancelled) return
      setServerChecked(true)
      if (result.agreed) {
        setTermsAgreed()
        setStatus('passed')
      } else {
        setStatus('required')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, isLoggedIn, exempt, serverChecked])

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
        onComplete={() => setStatus('passed')}
      />
    )
  }

  return <>{children}</>
}
