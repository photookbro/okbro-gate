'use client'

import { useEffect, useState } from 'react'
import { GpsPermissionModal } from '@/components/gps-permission-modal'
import { NotificationPermissionModal } from '@/components/notification-permission-modal'
import { InstagramFollowOnboardingModal } from '@/components/instagram-follow-onboarding-modal'
import { VerificationModal } from '@/components/verification-modal'
import { markFirstAppLaunchDone, isFirstAppLaunchPending } from '@/lib/app-first-launch'
import { markInstagramFollowOnboardingDone } from '@/lib/instagram-follow-onboarding'
import { createClient } from '@/lib/supabase/client'
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

type OnboardingStep = 'gps' | 'notification' | 'instagram' | 'verification' | null

export function AppFirstLaunchPermissions() {
  const [step, setStep] = useState<OnboardingStep>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [requestingGps, setRequestingGps] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [gpsSettingsGuide, setGpsSettingsGuide] = useState(false)
  const [requestingNotification, setRequestingNotification] = useState(false)

  useEffect(() => {
    if (!isFirstAppLaunchPending()) return
    setStep('gps')

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
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
      setStep('instagram')
    }
  }

  function handleNotificationSkip() {
    markNotificationPermissionAsked()
    setStep('instagram')
  }

  function handleInstagramComplete() {
    if (userId) markInstagramFollowOnboardingDone(userId)
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

      <InstagramFollowOnboardingModal
        open={step === 'instagram'}
        onComplete={handleInstagramComplete}
        onSkip={handleInstagramComplete}
      />

      <VerificationModal
        open={step === 'verification'}
        onComplete={() => void handleVerificationComplete()}
        onSkip={() => void handleVerificationComplete()}
      />
    </>
  )
}
