'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildAuthCallbackUrl } from '@/lib/app-origin'
import {
  getExternalBrowserInstructions,
  isInAppBrowser,
  openInExternalBrowser,
} from '@/lib/in-app-browser'

export default function LoginPage() {
  const supabase = createClient()
  const [inAppBrowser, setInAppBrowser] = useState(false)

  useEffect(() => {
    setInAppBrowser(isInAppBrowser())
  }, [])

  async function handleGoogleLogin() {
    if (inAppBrowser) {
      const proceed = confirm(
        '앱 내 브라우저에서는 구글 로그인이 차단될 수 있어요.\nSafari 또는 Chrome에서 열어주세요.\n\n그래도 시도할까요?'
      )
      if (!proceed) return
    }

    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next') ?? '/'
        : '/'

    const redirectTo = buildAuthCallbackUrl(next)

    if (process.env.NODE_ENV === 'development') {
      console.info('[auth] OAuth redirectTo', redirectTo)
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="card p-7 text-center">
          <img src="/icons/icon-192.png" alt="" width={72} height={72} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="page-title mb-2 text-center text-xl md:text-2xl">
            <span className="text-okbro-orange">OKbro</span>
            <span className="text-[var(--text)]">GATE</span>
          </h1>

          <div className="alert-warning text-left">
            <p className="font-semibold">⚠️ Google 계정으로만 로그인하세요</p>
            <p className="mt-1 text-sm">
              구글앨범을 이용을 위해서 꼭 구글 로그인 해주세요.
              {inAppBrowser ? (
                <>
                  <br />
                  {getExternalBrowserInstructions()}
                </>
              ) : null}
            </p>
          </div>

          {inAppBrowser && (
            <button type="button" onClick={() => openInExternalBrowser()} className="btn-primary mb-3">
              🌐 외부 브라우저로 열기
            </button>
          )}

          <button type="button" onClick={handleGoogleLogin} className="btn-primary">
            Google로 로그인
          </button>
        </div>
      </div>
    </div>
  )
}
