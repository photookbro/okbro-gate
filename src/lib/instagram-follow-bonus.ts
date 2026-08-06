import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateNewExpiresAt,
  formatVerificationDate,
  getDaysRemaining,
  inclusiveKstPeriodEndsAt,
  isExpiryActive,
} from '@/lib/order-verification'

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

/** 기준일 포함 N일 — 마지막 유효일 23:59:59.999 KST (레거시·테스트용) */
export function calculateInstagramBonusExpiresAt(
  firstCreatedAt: string | Date,
  bonusDays: number
): Date {
  const base = typeof firstCreatedAt === 'string' ? new Date(firstCreatedAt) : firstCreatedAt
  if (Number.isNaN(base.getTime()) || !Number.isFinite(bonusDays) || bonusDays <= 0) {
    return base
  }

  return inclusiveKstPeriodEndsAt(base, bonusDays)
}

export function isInstagramBonusActive(
  row: Pick<InstagramFollowBonusRow, 'status' | 'expires_at'> | null | undefined,
  now: Date = new Date()
): boolean {
  if (!row || row.status !== 'approved' || !row.expires_at) return false
  const expiresAt = new Date(row.expires_at)
  if (Number.isNaN(expiresAt.getTime())) return false
  return isExpiryActive(expiresAt, now)
}

/**
 * 유저의 승인 건 중 가장 유용한 1건.
 * (활성 있으면 만료일이 가장 늦은 활성, 없으면 최근 승인 건)
 */
export async function getApprovedInstagramFollowBonus(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<InstagramFollowBonusRow | null> {
  const { data, error } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('expires_at', { ascending: false, nullsFirst: false })

  if (error) throw error

  const rows = (data as InstagramFollowBonusRow[] | null) ?? []
  if (rows.length === 0) return null

  const active = rows.filter(row => isInstagramBonusActive(row, now))
  if (active.length > 0) {
    return active[0] ?? null
  }

  return rows[0] ?? null
}

/** 활성 혜택이 있으면 그 만료일(가장 늦은 값), 없으면 null */
export async function getActiveInstagramBonusExpiresAt(
  admin: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<Date | null> {
  const best = await getApprovedInstagramFollowBonus(admin, userId, now)
  if (!best?.expires_at || !isInstagramBonusActive(best, now)) return null
  const expiresAt = new Date(best.expires_at)
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt
}

/**
 * 새 팔로워 아이디 등록 시 만료일.
 * - 활성 혜택이 있으면 그 만료일에서 N일 연장
 * - 없으면 지금부터 N일
 */
export function calculateInstagramBonusClaimExpiresAt(
  previousActiveExpiresAt: Date | null,
  bonusDays: number,
  now: Date = new Date()
): Date {
  return calculateNewExpiresAt(previousActiveExpiresAt, bonusDays, now)
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
