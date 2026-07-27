'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InstagramFollowOnboardingModal } from '@/components/instagram-follow-onboarding-modal'
import { isFirstAppLaunchPending } from '@/lib/app-first-launch'
import {
  isInstagramFollowOnboardingPending,
  isRecentSignupForOnboarding,
  markInstagramFollowOnboardingDone,
} from '@/lib/instagram-follow-onboarding'

/**
 * 첫 실행 온보딩(GPS·알림·인증)이 이미 끝난 기기에서 신규 가입한 사용자에게
 * 인스타 팔로우 팝업을 1회만 보여줍니다.
 */
export function InstagramFollowSignupPrompt() {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isFirstAppLaunchPending()) return

    const supabase = createClient()
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return

      const user = session?.user
      if (!user?.id) return

      if (!isInstagramFollowOnboardingPending(user.id)) return
      if (
        !isRecentSignupForOnboarding(user.created_at, user.last_sign_in_at ?? undefined)
      ) {
        return
      }

      setUserId(user.id)
      setOpen(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  function handleDone() {
    if (userId) markInstagramFollowOnboardingDone(userId)
    setOpen(false)
  }

  return (
    <InstagramFollowOnboardingModal
      open={open}
      onComplete={handleDone}
      onSkip={handleDone}
    />
  )
}
