export const INSTAGRAM_FOLLOW_ONBOARDING_DONE_PREFIX =
  'okbro_instagram_follow_onboarding_done_'

function onboardingKey(userId: string): string {
  return `${INSTAGRAM_FOLLOW_ONBOARDING_DONE_PREFIX}${userId}`
}

export function isInstagramFollowOnboardingPending(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false
  try {
    return localStorage.getItem(onboardingKey(userId)) !== '1'
  } catch {
    return false
  }
}

export function markInstagramFollowOnboardingDone(userId: string): void {
  if (!userId) return
  try {
    localStorage.setItem(onboardingKey(userId), '1')
  } catch {
    // ignore
  }
}

/** OAuth 직후 등 가입 직후 온보딩 대상인지 (기존 회원 재로그인 제외) */
export function isRecentSignupForOnboarding(
  createdAt: string | undefined,
  lastSignInAt: string | undefined,
  maxAgeDays = 14
): boolean {
  if (!createdAt) return false

  const createdMs = new Date(createdAt).getTime()
  if (Number.isNaN(createdMs)) return false

  if (lastSignInAt) {
    const lastSignInMs = new Date(lastSignInAt).getTime()
    if (!Number.isNaN(lastSignInMs) && Math.abs(lastSignInMs - createdMs) < 10_000) {
      return true
    }
  }

  const ageMs = Date.now() - createdMs
  return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1000
}
