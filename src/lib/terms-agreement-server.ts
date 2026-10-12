import { NextResponse } from 'next/server'
import type { AuthenticatedUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { TERMS_VERSION } from '@/lib/terms-agreement'

/** app_metadata 는 service role 만 쓸 수 있어 사용자가 위조할 수 없음 */
const TERMS_APP_METADATA_KEY = 'terms_agreed_version'

/**
 * access token 의 app_metadata 는 토큰 재발급(최대 1시간) 전까지 갱신되지 않음.
 * 그 사이 같은 인스턴스에서 DB 조회·기록을 반복하지 않도록 동의 확인 결과를 기억.
 */
const CONFIRMED_TTL_MS = 60 * 60 * 1000
const CONFIRMED_MAX_ENTRIES = 5000
const confirmedAgreements = new Map<string, number>()

function isRecentlyConfirmed(userId: string): boolean {
  const expiresAt = confirmedAgreements.get(userId)
  if (!expiresAt) return false
  if (expiresAt > Date.now()) return true
  confirmedAgreements.delete(userId)
  return false
}

function rememberConfirmed(userId: string) {
  if (confirmedAgreements.size >= CONFIRMED_MAX_ENTRIES) confirmedAgreements.clear()
  confirmedAgreements.set(userId, Date.now() + CONFIRMED_TTL_MS)
}

export async function hasTermsAgreement(userId: string): Promise<boolean> {
  if (!userId) return false

  const { data, error } = await supabaseAdmin()
    .from('terms_agreements')
    .select('id')
    .eq('user_id', userId)
    .eq('version', TERMS_VERSION)
    .maybeSingle()

  if (error) {
    console.error('[terms-agreement-server] lookup failed:', error)
    return false
  }

  return !!data
}

/** 토큰의 app_metadata 에 현재 버전 동의가 기록돼 있는지 (DB 조회 없음) */
export function hasTermsAgreementClaim(user: Pick<AuthenticatedUser, 'app_metadata'>): boolean {
  return user.app_metadata?.[TERMS_APP_METADATA_KEY] === TERMS_VERSION
}

/** 동의 확인 후 1회 기록 — 이후 요청은 terms_agreements 조회를 건너뜀. 실패해도 동의 판정에는 영향 없음 */
export async function recordTermsAgreementClaim(
  user: Pick<AuthenticatedUser, 'id' | 'app_metadata'>
): Promise<void> {
  if (hasTermsAgreementClaim(user) || isRecentlyConfirmed(user.id)) return
  try {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, [TERMS_APP_METADATA_KEY]: TERMS_VERSION },
    })
    if (error) {
      console.error('[terms-agreement-server] record claim failed:', error.message)
      return
    }
    rememberConfirmed(user.id)
  } catch (err) {
    console.error('[terms-agreement-server] record claim threw:', err)
  }
}

/** app_metadata 기록 우선, 없으면 DB 확인 후 기록 */
export async function hasUserTermsAgreement(
  user: Pick<AuthenticatedUser, 'id' | 'app_metadata'>
): Promise<boolean> {
  if (hasTermsAgreementClaim(user) || isRecentlyConfirmed(user.id)) return true
  const agreed = await hasTermsAgreement(user.id)
  if (agreed) {
    await recordTermsAgreementClaim(user)
    rememberConfirmed(user.id)
  }
  return agreed
}

/** 약관 미동의 시 403. 동의했으면 user 반환. */
export async function requireTermsAgreement<T extends AuthenticatedUser>(
  user: T | null
): Promise<T | NextResponse> {
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const agreed = await hasUserTermsAgreement(user)
  if (!agreed) {
    return NextResponse.json({ error: '이용 안내 동의가 필요해요' }, { status: 403 })
  }

  return user
}
