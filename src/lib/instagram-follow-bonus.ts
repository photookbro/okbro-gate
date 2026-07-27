import type { SupabaseClient } from '@supabase/supabase-js'
import { getDaysRemaining } from '@/lib/order-verification'
import { formatVerificationDate } from '@/lib/order-verification'

export type InstagramFollowBonusRow = {
  id: string
  user_id: string
  instagram_handle: string
  status: 'pending' | 'approved' | 'rejected'
  approved_at: string | null
  bonus_days_granted: number | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type InstagramFollowBonusUserState =
  | 'not_submitted'
  | 'not_matched'
  | 'active'
  | 'expired'

export type InstagramFollowBonusStatus = {
  state: InstagramFollowBonusUserState
  bonus_days_setting: number
  instagram_handle: string | null
  approved_at: string | null
  expires_at: string | null
  days_remaining: number | null
  period_label: string | null
}

function getKstDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  const day = Number(parts.find(part => part.type === 'day')?.value)
  return { year, month, day }
}

/** 가입일 포함 N일 — 마지막 유효일 23:59:59.999 KST */
export function calculateInstagramBonusExpiresAt(
  firstCreatedAt: string | Date,
  bonusDays: number
): Date {
  const base = typeof firstCreatedAt === 'string' ? new Date(firstCreatedAt) : firstCreatedAt
  if (Number.isNaN(base.getTime()) || !Number.isFinite(bonusDays) || bonusDays <= 0) {
    return base
  }

  const { year, month, day } = getKstDateParts(base)
  const lastValidUtc = new Date(Date.UTC(year, month - 1, day + bonusDays - 1, 14, 59, 59, 999))
  return lastValidUtc
}

export function isInstagramBonusActive(
  row: Pick<InstagramFollowBonusRow, 'status' | 'expires_at'> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!row || row.status !== 'approved' || !row.expires_at) return false
  const expiresAt = new Date(row.expires_at)
  if (Number.isNaN(expiresAt.getTime())) return false
  return now <= expiresAt
}

export async function getApprovedInstagramFollowBonus(
  admin: SupabaseClient,
  userId: string
): Promise<InstagramFollowBonusRow | null> {
  const { data, error } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) throw error
  return (data as InstagramFollowBonusRow | null) ?? null
}

export async function getLatestInstagramFollowBonusAttempt(
  admin: SupabaseClient,
  userId: string
): Promise<InstagramFollowBonusRow | null> {
  const { data, error } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as InstagramFollowBonusRow | null) ?? null
}

export function buildInstagramFollowBonusStatus(
  approved: InstagramFollowBonusRow | null,
  latestAttempt: InstagramFollowBonusRow | null,
  bonusDaysSetting: number,
  now: Date = new Date()
): InstagramFollowBonusStatus {
  if (approved) {
    const active = isInstagramBonusActive(approved, now)
    const daysRemaining =
      approved.expires_at && active
        ? Math.max(0, getDaysRemaining(new Date(approved.expires_at), now))
        : 0

    if (active) {
      return {
        state: 'active',
        bonus_days_setting: bonusDaysSetting,
        instagram_handle: approved.instagram_handle,
        approved_at: approved.approved_at,
        expires_at: approved.expires_at,
        days_remaining: daysRemaining,
        period_label: approved.approved_at
          ? `${formatVerificationDate(approved.approved_at)} ~ ${formatVerificationDate(approved.expires_at)}`
          : null,
      }
    }

    return {
      state: 'expired',
      bonus_days_setting: bonusDaysSetting,
      instagram_handle: approved.instagram_handle,
      approved_at: approved.approved_at,
      expires_at: approved.expires_at,
      days_remaining: 0,
      period_label: approved.expires_at
        ? `${formatVerificationDate(approved.approved_at)} ~ ${formatVerificationDate(approved.expires_at)}`
        : null,
    }
  }

  if (latestAttempt?.status === 'rejected') {
    return {
      state: 'not_matched',
      bonus_days_setting: bonusDaysSetting,
      instagram_handle: latestAttempt.instagram_handle,
      approved_at: null,
      expires_at: null,
      days_remaining: null,
      period_label: null,
    }
  }

  return {
    state: 'not_submitted',
    bonus_days_setting: bonusDaysSetting,
    instagram_handle: null,
    approved_at: null,
    expires_at: null,
    days_remaining: null,
    period_label: null,
  }
}
