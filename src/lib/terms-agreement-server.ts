import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { TERMS_VERSION } from '@/lib/terms-agreement'

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

/** 약관 미동의 시 403. 동의했으면 user 반환. */
export async function requireTermsAgreement(
  user: User | null
): Promise<User | NextResponse> {
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const agreed = await hasTermsAgreement(user.id)
  if (!agreed) {
    return NextResponse.json({ error: '이용 안내 동의가 필요해요' }, { status: 403 })
  }

  return user
}
