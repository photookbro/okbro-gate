'use client'

import { useEffect, useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { NotificationPermissionModal } from '@/components/notification-permission-modal'
import { VerificationModal } from '@/components/verification-modal'
import { markFirstAppLaunchDone, isFirstAppLaunchPending } from '@/lib/app-first-launch'
import {
  getPermissionSnapshot,
  markNotificationPermissionAsked,
  setPermissionAck,
  syncPermissionAckFromSnapshot,
} from '@/lib/app-permissions'
import {
  geolocationFailureMessage,
  queryGeolocationPermission,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'
import { ensurePushSubscription } from '@/lib/push-client'

type OnboardingStep = 'gps' | 'notification' | 'verification' | null

export function AppFirstLaunchPermissions() {
  const [step, setStep] = useState<OnboardingStep>(null)
  const [requestingGps, setRequestingGps] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [gpsSettingsGuide, setGpsSettingsGuide] = useState(false)
  const [requestingNotification, setRequestingNotification] = useState(false)

  useEffect(() => {
    if (!isFirstAppLaunchPending()) return
    setStep('gps')
  }, [])

  function finishOnboarding() {
    markFirstAppLaunchDone()
    setStep(null)
  }

  async function handleGpsAllow() {
    setGpsError('')
    setRequestingGps(true)

    try {
      const result = await requestPreciseGeolocation()
      const snapshot = await getPermissionSnapshot()

      if (result.granted || snapshot.gps === 'granted') {
        setPermissionAck(true)
        setStep('notification')
        return
      }

      const permission = await queryGeolocationPermission()
      if (permission === 'denied') {
        setGpsSettingsGuide(true)
      }
      setGpsError(geolocationFailureMessage(result.reason))
    } finally {
      setRequestingGps(false)
    }
  }

  function handleGpsSkip() {
    setPermissionAck(false)
    setStep('notification')
  }

  async function handleNotificationAllow() {
    setRequestingNotification(true)
    try {
      await ensurePushSubscription()
    } finally {
      markNotificationPermissionAsked()
      setRequestingNotification(false)
      setStep('verification')
    }
  }

  function handleNotificationSkip() {
    markNotificationPermissionAsked()
    setStep('verification')
  }

  async function handleVerificationComplete() {
    const snapshot = await getPermissionSnapshot()
    syncPermissionAckFromSnapshot(snapshot)
    finishOnboarding()
  }

  if (!step) return null

  return (
    <>
      <GpsPermissionModal
        open={step === 'gps'}
        mode="onboarding"
        requesting={requestingGps}
        errorMessage={gpsError}
        showSettingsGuide={gpsSettingsGuide}
        onAllow={() => void handleGpsAllow()}
        onSkip={handleGpsSkip}
        onDismiss={handleGpsSkip}
        showEmphasisNotice
        showBackgroundNotice
      />

      <NotificationPermissionModal
        open={step === 'notification'}
        requesting={requestingNotification}
        onAllow={() => void handleNotificationAllow()}
        onSkip={handleNotificationSkip}
      />

      <VerificationModal
        open={step === 'verification'}
        onComplete={() => void handleVerificationComplete()}
        onSkip={() => void handleVerificationComplete()}
      />
    </>
  )
}
