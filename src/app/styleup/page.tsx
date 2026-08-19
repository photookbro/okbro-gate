'use client'

import { useEffect, useState } from 'react'

const ENHANCE_SRC = '/photo-enhance.html'

export default function StyleUpPage() {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)

  useEffect(() => {
    function syncHashToIframe() {
      const hash = window.location.hash
      setIframeSrc(hash ? `${ENHANCE_SRC}${hash}` : ENHANCE_SRC)
    }

    syncHashToIframe()
    window.addEventListener('hashchange', syncHashToIframe)
    return () => window.removeEventListener('hashchange', syncHashToIframe)
  }, [])

  return (
    <div className="styleup-page">
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          title="오켱게이트 사진 보정"
          className="styleup-frame"
          allow="clipboard-write"
        />
      ) : (
        <p className="styleup-loading">보정 화면 준비 중...</p>
      )}
    </div>
  )
}
