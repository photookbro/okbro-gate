import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { deleteUserAccount } from '@/lib/delete-user-account-server'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  try {
    await deleteUserAccount(supabaseAdmin(), user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const detail =
      error && typeof error === 'object'
        ? {
            message: 'message' in error ? String(error.message) : undefined,
            code: 'code' in error ? String(error.code) : undefined,
          }
        : { message: String(error) }
    console.error('[account/delete]', detail, error)
    return NextResponse.json({ error: '회원 탈퇴에 실패했어요' }, { status: 500 })
  }
}
