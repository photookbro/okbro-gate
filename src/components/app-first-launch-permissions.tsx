'use client'

import { useEffect } from 'react'
import { markFirstAppLaunchDone, isFirstAppLaunchPending } from '@/lib/app-first-launch'
import { requestPreciseGeolocation } from '@/lib/geolocation-request'
import { isStandaloneDisplayMode } from '@/lib/pwa-install'
import { ensurePushSubscription } from '@/lib/push-client'

async function requestPushPermission(): Promise<void> {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    await ensurePushSubscription()
    return
  }
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      await ensurePushSubscription()
    }
  }
}

export function AppFirstLaunchPermissions() {
  useEffect(() => {
    if (!isStandaloneDisplayMode()) return
    if (!isFirstAppLaunchPending()) return

    void (async () => {
      await requestPreciseGeolocation()
      await requestPushPermission()
      markFirstAppLaunchDone()
    })()
  }, [])

  return null
}
