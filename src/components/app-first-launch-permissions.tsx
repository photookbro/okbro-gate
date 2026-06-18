'use client'

import { useEffect } from 'react'
import { markFirstAppLaunchDone, isFirstAppLaunchPending } from '@/lib/app-first-launch'
import { isStandaloneDisplayMode } from '@/lib/pwa-install'
import { ensurePushSubscription } from '@/lib/push-client'

async function requestLocationPermission(): Promise<void> {
  if (!('geolocation' in navigator)) return
  await new Promise<void>(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => resolve(),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    )
  })
}

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
      await requestLocationPermission()
      await requestPushPermission()
      markFirstAppLaunchDone()
    })()
  }, [])

  return null
}
