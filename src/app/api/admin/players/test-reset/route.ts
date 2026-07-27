import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    (typeof error.message === 'string' && error.message.includes('schema cache'))
  )
}

async function deleteUserRows(
  admin: SupabaseClient,
  table: string,
  userId: string
): Promise<{ deleted: number; skippedMissingTable: boolean }> {
  const { data, error } = await admin.from(table).delete().eq('user_id', userId).select('user_id')

  if (error) {
    if (isMissingTableError(error)) {
      return { deleted: 0, skippedMissingTable: true }
    }
    throw error
  }

  return { deleted: data?.length ?? 0, skippedMissingTable: false }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  let body: { user_id?: string; reset_gps?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요' }, { status: 400 })
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return NextResponse.json({ error: 'user_id가 필요해요' }, { status: 400 })
  }

  const resetGps = body.reset_gps === true
  const admin = supabaseAdmin()

  try {
    // auth.users(로그인 계정)는 유지. profiles.first_created_at 은 재가입처럼 현재 시각으로 리셋.
    const nowIso = new Date().toISOString()

    const [instagram, orders] = await Promise.all([
      deleteUserRows(admin, 'instagram_follow_bonus', userId),
      deleteUserRows(admin, 'orders', userId),
    ])

    let firstCreatedAtReset = false
    const { data: existingProfile, error: profileSelectError } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileSelectError) {
      if (!isMissingTableError(profileSelectError)) throw profileSelectError
    } else if (existingProfile?.user_id) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ first_created_at: nowIso })
        .eq('user_id', userId)

      if (profileUpdateError) throw profileUpdateError
      firstCreatedAtReset = true
    } else {
      const { error: profileInsertError } = await admin.from('profiles').insert({
        user_id: userId,
        first_created_at: nowIso,
      })

      if (profileInsertError) {
        if (!isMissingTableError(profileInsertError)) throw profileInsertError
      } else {
        firstCreatedAtReset = true
      }
    }

    let gpsLogsDeleted = 0
    let gpsPrefsDeleted = 0

    if (resetGps) {
      const [gpsLogs, gpsPrefs] = await Promise.all([
        deleteUserRows(admin, 'gps_logs', userId),
        deleteUserRows(admin, 'user_gps_tracking_prefs', userId),
      ])
      gpsLogsDeleted = gpsLogs.deleted
      gpsPrefsDeleted = gpsPrefs.deleted
    }

    return NextResponse.json({
      success: true,
      message: '테스트 데이터가 초기화되었습니다 (가입일 포함)',
      deleted: {
        instagram_follow_bonus: instagram.deleted,
        orders: orders.deleted,
        gps_logs: gpsLogsDeleted,
        user_gps_tracking_prefs: gpsPrefsDeleted,
      },
      first_created_at_reset: firstCreatedAtReset,
      first_created_at: firstCreatedAtReset ? nowIso : null,
      reset_gps: resetGps,
    })
  } catch (error) {
    console.error('[admin/players/test-reset]', error)
    return NextResponse.json({ error: '테스트 리셋에 실패했어요' }, { status: 500 })
  }
}
