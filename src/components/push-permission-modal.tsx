'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PushPermissionPrompt } from '@/components/push-permission-prompt'
import { isFirstAppLaunchPending } from '@/lib/app-first-launch'
import { dismissPushPrompt, shouldShowPushPrompt } from '@/lib/push-permission'
import { isStandaloneDisplayMode } from '@/lib/pwa-install'

export function PushPermissionModal() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pathname?.startsWith('/admin')) return
    if (isStandaloneDisplayMode() && isFirstAppLaunchPending()) return
    if (!shouldShowPushPrompt()) return
    setOpen(true)
  }, [pathname])

  function handleClose() {
    dismissPushPrompt()
    setOpen(false)
  }

  return (
    <PushPermissionPrompt
      open={open}
      mode="standalone"
      showBackgroundNotice
      onComplete={handleClose}
      onSkip={handleClose}
    />
  )
}
