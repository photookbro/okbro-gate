'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getExternalBrowserInstructions,
  isInAppBrowser,
  openInExternalBrowser,
} from '@/lib/in-app-browser'

export default function SignupPage() {
  const [inAppBrowser, setInAppBrowser] = useState(false)

  useEffect(() => {
    setInAppBrowser(isInAppBrowser())
  }, [])

  async function handleGoogleSignup() {
    if (inAppBrowser) {
      const proceed = confirm(
        '앱 내 브라우저에서는 구글 로그인이 차단될 수 있어요.\nSafari 또는 Chrome에서 열어주세요.\n\n그래도 시도할까요?'
      )
      if (!proceed) return
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="card p-7 text-center">
          <img src="/icons/icon-192.png" alt="" width={72} height={72} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="page-title mb-2 text-center text-xl md:text-2xl">
            <span className="text-okbro-orange">OKbro</span>GATE
          </h1>

          <div className="alert-warning text-left">
            <p className="font-semibold">⚠️ Google 계정으로만 회원가입됩니다</p>
            <p className="mt-1 text-sm">
              이메일 입력 회원가입은 지원하지 않습니다.
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

          <button type="button" onClick={handleGoogleSignup} className="btn-primary">
            Google로 회원가입
          </button>
        </div>
      </div>
    </div>
  )
}

