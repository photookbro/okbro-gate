import {
  calculateInstagramBonusClaimExpiresAt,
  isInstagramBonusActive,
} from '@/lib/instagram-follow-bonus'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'
import {
  latestActiveExpiresAt,
  resolveExpiresAt,
  type OrderRecord,
} from '@/lib/order-verification'

/** 이보다 작은 목록은 전체 팔로워가 아닐 수 있어 불일치 회수를 하지 않음 */
export const MISMATCH_SWEEP_MIN_HANDLES = 100
/** 직전 전체 스냅샷 대비 이 비율보다 작으면 부분 목록으로 보고 불일치 회수를 건너뜀 */
export const SNAPSHOT_MIN_RATIO = 0.8

export type MismatchSweepSkipReason = 'single_file' | 'smaller_than_previous'

export type MismatchSweepDecision =
  | { sweep: true }
  | { sweep: false; reason: MismatchSweepSkipReason }

/**
 * 불일치 회수는 전체 팔로워 스냅샷으로 볼 수 있는 업로드에서만.
 * baselineTotal: 직전 전체 스냅샷(파일 2개 이상 · 회수 실행) 작업의 total_parsed, 없으면 null
 */
export function decideMismatchSweep(input: {
  fileCount: number
  totalParsed: number
  baselineTotal: number | null
}): MismatchSweepDecision {
  if (input.fileCount < 2) return { sweep: false, reason: 'single_file' }
  if (
    input.baselineTotal !== null &&
    input.baselineTotal > 0 &&
    input.totalParsed < input.baselineTotal * SNAPSHOT_MIN_RATIO
  ) {
    return { sweep: false, reason: 'smaller_than_previous' }
  }
  return { sweep: true }
}

export type PendingFollowClaim = {
  id: string
  user_id: string
  instagram_handle: string
  manually_unlocked: boolean
  created_at: string
}

/** 유저의 기존 인스타 혜택 행 (approved 또는 pending+manually_unlocked) */
export type UserInstagramBonusRow = {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  expires_at: string | null
  manually_unlocked: boolean
}

export type FollowApprovalPlanRow = {
  id: string
  user_id: string
  approved_at: string
  bonus_days_granted: number
  expires_at: string
  history_handle: string | null
  notify: boolean
}

export type FollowMatchPlan = {
  approvals: FollowApprovalPlanRow[]
  mismatchIds: string[]
  /** 팔로워 목록엔 있지만 같은 아이디가 이미 승인돼 있어 건너뛴 건 */
  skippedHandleTaken: number
}

export function buildFollowerHandleSet(usernames: string[]): Set<string> {
  return new Set(usernames.map(u => u.trim().toLowerCase()).filter(Boolean))
}

function expiresDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function latestActiveInstagramExpires(rows: UserInstagramBonusRow[], now: Date): Date | null {
  let best: Date | null = null
  for (const row of rows) {
    if (!isInstagramBonusActive(row, now)) continue
    const expires = expiresDate(row.expires_at)
    if (expires && (!best || expires.getTime() > best.getTime())) best = expires
  }
  return best
}

/** 주문 중 만료일이 가장 늦은 1건 (null은 뒤로) — 단건 조회의 order(expires_at desc nulls last)와 동일 */
export function pickLatestOrder<T extends OrderRecord>(orders: T[]): T | null {
  let best: T | null = null
  let bestTime = Number.NEGATIVE_INFINITY
  for (const order of orders) {
    const time = expiresDate(order.expires_at)?.getTime() ?? Number.NEGATIVE_INFINITY
    if (!best || time > bestTime) {
      best = order
      bestTime = time
    }
  }
  return best
}

/**
 * 대기 신청 ↔ 팔로워 목록 대조 계획 (DB 호출 없음).
 * 건별 승인 로직(approveInstagramFollowPendingRow)과 같은 만료일 규칙을 유저별로 순서대로 적용.
 */
export function planInstagramFollowMatch(input: {
  pendingRows: PendingFollowClaim[]
  handleSet: Set<string>
  /** 이미 approved 인 instagram_handle 값들 (정확히 같은 문자열) */
  approvedHandles: Set<string>
  userBonusRows: UserInstagramBonusRow[]
  latestOrderByUser: Map<string, OrderRecord>
  bonusDays: number
  verifiedPeriodDays: number
  now: Date
  /** false면 승인 매칭만 하고 불일치 회수 대상은 만들지 않음 (부분 목록) */
  sweepMismatches: boolean
}): FollowMatchPlan {
  const { handleSet, bonusDays, verifiedPeriodDays, now, sweepMismatches } = input
  const nowIso = now.toISOString()

  const pending = [...input.pendingRows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const bonusByUser = new Map<string, UserInstagramBonusRow[]>()
  for (const row of input.userBonusRows) {
    const list = bonusByUser.get(row.user_id) ?? []
    list.push({ ...row })
    bonusByUser.set(row.user_id, list)
  }

  const takenHandles = new Set(input.approvedHandles)
  const notifiedUsers = new Set<string>()
  const approvals: FollowApprovalPlanRow[] = []
  const mismatchIds: string[] = []
  let skippedHandleTaken = 0

  for (const row of pending) {
    const handle = row.instagram_handle.trim()
    const inFollowers = handle.length > 0 && handleSet.has(handle.toLowerCase())

    if (!inFollowers) {
      if (
        sweepMismatches &&
        row.manually_unlocked &&
        handleSet.size >= MISMATCH_SWEEP_MIN_HANDLES
      ) {
        mismatchIds.push(row.id)
      }
      continue
    }

    if (takenHandles.has(handle)) {
      skippedHandleTaken++
      continue
    }

    const userRows = bonusByUser.get(row.user_id) ?? []
    const order = input.latestOrderByUser.get(row.user_id)
    const purchaseExpires = order ? resolveExpiresAt(order, verifiedPeriodDays) : null
    const previousActive = latestActiveExpiresAt(
      [latestActiveInstagramExpires(userRows, now), purchaseExpires],
      now
    )
    const expiresAt = calculateInstagramBonusClaimExpiresAt(previousActive, bonusDays, now)
    const expiresIso = expiresAt.toISOString()

    const notify = !row.manually_unlocked && !notifiedUsers.has(row.user_id)
    if (!row.manually_unlocked) notifiedUsers.add(row.user_id)

    approvals.push({
      id: row.id,
      user_id: row.user_id,
      approved_at: nowIso,
      bonus_days_granted: bonusDays,
      expires_at: expiresIso,
      history_handle: normalizeInstagramHandle(handle),
      notify,
    })

    takenHandles.add(handle)

    const existing = userRows.find(r => r.id === row.id)
    if (existing) {
      existing.status = 'approved'
      existing.expires_at = expiresIso
      existing.manually_unlocked = false
    } else {
      userRows.push({
        id: row.id,
        user_id: row.user_id,
        status: 'approved',
        expires_at: expiresIso,
        manually_unlocked: false,
      })
      bonusByUser.set(row.user_id, userRows)
    }
  }

  return { approvals, mismatchIds, skippedHandleTaken }
}
