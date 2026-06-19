'use client'

import { useEffect, useState } from 'react'
import { detectInAppBrowser } from '@/lib/in-app-browser'

async function copyUrlToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    } catch {
      return false
    }
  }
}

export function InappBrowserWarning() {
  const [show, setShow] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    setShow(detectInAppBrowser() !== null)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  async function handleCopyUrl() {
    const url = window.location.href
    const success = await copyUrlToClipboard(url)
    if (success) {
      setToast(true)
    }
  }

  if (!show) return null

  return (
    <>
      <div className="inapp-browser-overlay">
        <div className="inapp-browser-card">
          <h1 className="inapp-browser-title">외부 브라우저에서 열어주세요</h1>
          <p className="inapp-browser-text">
            카카오톡, 인스타그램 등 앱 내에서는
            <br />
            구글 로그인이 제한됩니다.
          </p>
          <p className="inapp-browser-text">
            주소를 복사해서 Chrome(또는 Safari)에서
            <br />
            열어주세요.
          </p>
          <button type="button" onClick={() => void handleCopyUrl()} className="inapp-browser-copy-btn">
            현재 URL 복사하기
          </button>
        </div>
      </div>

      {toast ? (
        <div className="inapp-browser-toast" role="status" aria-live="polite">
          복사되었습니다
        </div>
      ) : null}
    </>
  )
}
