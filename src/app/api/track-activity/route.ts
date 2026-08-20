import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { ensureUserProfile } from '@/lib/user-profile-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  try {
    await ensureUserProfile(admin, user.id, user.created_at ?? now)

    const { error } = await admin
      .from('profiles')
      .update({ last_active_at: now })
      .eq('user_id', user.id)

    if (error) {
      if (error.code === '42703' || error.message?.includes('last_active_at')) {
        return NextResponse.json(
          { error: 'last_active_at column missing — run Supabase migration' },
          { status: 503 }
        )
      }
      console.error('[track-activity]', error)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[track-activity]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
