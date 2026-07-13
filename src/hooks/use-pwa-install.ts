'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type BeforeInstallPromptEvent,
  dismissPwaInstall,
  isBeforeInstallPromptEvent,
  isPwaInstallDismissed,
  isStandaloneDisplayMode,
} from '@/lib/pwa-install'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setIsInstalled(isStandaloneDisplayMode())
    setDismissed(isPwaInstallDismissed())

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      if (!isBeforeInstallPromptEvent(event)) return
      setDeferredPrompt(event)
    }

    function handleAppInstalled() {
      setDeferredPrompt(null)
      setIsInstalled(true)
      dismissPwaInstall()
      setDismissed(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const canInstall = !!deferredPrompt && !isInstalled

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstalled(true)
        return true
      }
      return false
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    dismissPwaInstall()
    setDismissed(true)
  }, [])

  return {
    canInstall,
    isInstalled,
    installing,
    promptInstall,
    dismissed,
    dismiss,
  }
}
