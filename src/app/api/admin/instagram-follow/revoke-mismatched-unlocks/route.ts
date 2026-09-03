import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { revokeExistingMismatchedManualUnlocks } from '@/lib/instagram-follow-approve-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DEFAULT_EXCLUDE_EMAILS = [
  'ig-manual-prod@okbro.internal',
  'ig-approved-prod@okbro.internal',
  'ig-auto-prod@okbro.internal',
]

function shouldExcludeEmail(
  email: string,
  extraEmails: Set<string>,
  includeInternalAccounts: boolean
): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  if (extraEmails.has(normalized)) return true
  if (includeInternalAccounts) return false
  return normalized.endsWith('@okbro.internal')
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: { exclude_emails?: string[]; dry_run?: boolean; include_internal_accounts?: boolean } =
    {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const excludeEmails = new Set(
    (
      Array.isArray(body.exclude_emails)
        ? body.exclude_emails
        : body.include_internal_accounts
          ? []
          : DEFAULT_EXCLUDE_EMAILS
    )
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
  const includeInternalAccounts = body.include_internal_accounts === true

  const admin = supabaseAdmin()
  const { data: flagged, error } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle, manually_unlocked, manual_unlock_verified_mismatch')
    .eq('status', 'pending')
    .eq('manually_unlocked', true)
    .eq('manual_unlock_verified_mismatch', true)

  if (error) {
    console.error('[admin/instagram-follow/revoke-mismatched-unlocks] lookup', error)
    return NextResponse.json({ error: '불일치 건 조회 실패' }, { status: 500 })
  }

  const excludeUserIds = new Set<string>()
  const rows = []

  for (const row of flagged ?? []) {
    const { data: userData } = await admin.auth.admin.getUserById(row.user_id)
    const email = userData.user?.email?.toLowerCase() ?? ''
    const excluded = shouldExcludeEmail(email, excludeEmails, includeInternalAccounts)
    if (excluded) excludeUserIds.add(row.user_id)
    rows.push({
      id: row.id,
      user_id: row.user_id,
      instagram_handle: row.instagram_handle,
      email: email || null,
      excluded,
    })
  }

  if (body.dry_run) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      total: rows.length,
      will_revoke: rows.filter(row => !row.excluded).length,
      excluded: rows.filter(row => row.excluded).length,
      rows,
    })
  }

  const result = await revokeExistingMismatchedManualUnlocks(admin, { excludeUserIds })

  return NextResponse.json({
    success: true,
    dry_run: false,
    total: rows.length,
    revoked: result.revoked,
    excluded: rows.filter(row => row.excluded).length,
    mismatch_push_sent: result.push_sent,
    mismatch_push_failed: result.push_failed,
    mismatch_no_subscription: result.no_subscription,
    rows,
  })
}
