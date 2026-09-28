import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { requireTermsAgreement } from '@/lib/terms-agreement-server'
import { normalizeInstagramHandle, isBrandOwnInstagramHandle } from '@/lib/instagram-handle'
import { instagramOwnAccountClaimBlockedMessage } from '@/lib/instagram-follow-copy'
import { submitInstagramFollowClaim } from '@/lib/instagram-follow-claim-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  const user = await requireTermsAgreement(authUser)
  if (user instanceof NextResponse) return user

  const body = await req.json().catch(() => ({}))
  const handle = normalizeInstagramHandle(
    typeof body.instagram_handle === 'string' ? body.instagram_handle : ''
  )

  if (!handle) {
    return NextResponse.json({ error: '인스타 아이디를 올바르게 입력해주세요' }, { status: 400 })
  }

  if (isBrandOwnInstagramHandle(handle)) {
    return NextResponse.json(
      { error: instagramOwnAccountClaimBlockedMessage() },
      { status: 400 }
    )
  }

  const result = await submitInstagramFollowClaim(supabaseAdmin(), user, handle)
  return NextResponse.json(result.body, { status: result.httpStatus })
}
