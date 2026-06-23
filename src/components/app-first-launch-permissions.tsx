'use client'

import { useEffect, useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { PushPermissionPrompt } from '@/components/push-permission-prompt'
import { VerificationModal } from '@/components/verification-modal'
import { markFirstAppLaunchDone, isFirstAppLaunchPending } from '@/lib/app-first-launch'
import {
  getPermissionSnapshot,
  setPermissionAck,
  syncPermissionAckFromSnapshot,
} from '@/lib/app-permissions'
import {
  geolocationFailureMessage,
  queryGeolocationPermission,
  requestPreciseGeolocation,
} from '@/lib/geolocation-request'
import { dismissPushPrompt } from '@/lib/push-permission'

type OnboardingStep = 'gps' | 'push' | 'verification' | null

export function AppFirstLaunchPermissions() {
  const [step, setStep] = useState<OnboardingStep>(null)
  const [requestingGps, setRequestingGps] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [gpsSettingsGuide, setGpsSettingsGuide] = useState(false)

  useEffect(() => {
    if (!isFirstAppLaunchPending()) return
    setStep('gps')
  }, [])

  function finishOnboarding() {
    dismissPushPrompt()
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
        setPermissionAck('gps', true)
        setStep('push')
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
    setPermissionAck('gps', false)
    setStep('push')
  }

  function handlePushComplete() {
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    setPermissionAck('notification', granted)
    setStep('verification')
  }

  function handlePushSkip() {
    setPermissionAck('notification', false)
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

      <PushPermissionPrompt
        open={step === 'push'}
        mode="onboarding"
        showBackgroundNotice
        onComplete={handlePushComplete}
        onSkip={handlePushSkip}
      />

      <VerificationModal
        open={step === 'verification'}
        onComplete={() => void handleVerificationComplete()}
        onSkip={() => void handleVerificationComplete()}
      />
    </>
  )
}
