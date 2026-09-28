/**
 * 대조 계획(순수 함수) 단위 테스트
 * npx tsx scripts/test-instagram-follow-match-plan.ts
 */
import assert from 'node:assert/strict'
import {
  MISMATCH_SWEEP_MIN_HANDLES,
  buildFollowerHandleSet,
  pickLatestOrder,
  planInstagramFollowMatch,
  type PendingFollowClaim,
  type UserInstagramBonusRow,
} from '../src/lib/instagram-follow-match-plan.ts'
import { calculateNewExpiresAt, extendKstPeriodEndsAt, inclusiveKstPeriodEndsAt } from '../src/lib/order-verification.ts'

const now = new Date('2026-09-28T03:00:00.000Z') // 12:00 KST
const bonusDays = 5
const verifiedPeriodDays = 30

function followers(extra: string[] = []): Set<string> {
  const filler = Array.from({ length: MISMATCH_SWEEP_MIN_HANDLES }, (_, i) => `filler_${i}`)
  return buildFollowerHandleSet([...filler, ...extra])
}

function pending(
  id: string,
  userId: string,
  handle: string,
  manuallyUnlocked: boolean,
  createdAt = '2026-09-27T00:00:00.000Z'
): PendingFollowClaim {
  return { id, user_id: userId, instagram_handle: handle, manually_unlocked: manuallyUnlocked, created_at: createdAt }
}

function plan(input: {
  pendingRows: PendingFollowClaim[]
  handleSet: Set<string>
  approvedHandles?: string[]
  userBonusRows?: UserInstagramBonusRow[]
  orders?: Record<string, { order_number: string; used_at: string; expires_at: string | null }>
}) {
  return planInstagramFollowMatch({
    pendingRows: input.pendingRows,
    handleSet: input.handleSet,
    approvedHandles: new Set(input.approvedHandles ?? []),
    userBonusRows: input.userBonusRows ?? [],
    latestOrderByUser: new Map(Object.entries(input.orders ?? {})),
    bonusDays,
    verifiedPeriodDays,
    now,
  })
}

// 1) 잠긴 pending + 팔로워 → 승인, 푸시 대상, 오늘부터 N일
{
  const result = plan({ pendingRows: [pending('a', 'u1', 'Alice', false)], handleSet: followers(['alice']) })
  assert.equal(result.approvals.length, 1)
  assert.equal(result.approvals[0].notify, true)
  assert.equal(result.approvals[0].history_handle, 'alice')
  assert.equal(result.approvals[0].expires_at, inclusiveKstPeriodEndsAt(now, bonusDays).toISOString())
  assert.deepEqual(result.mismatchIds, [])
}

// 2) 수동 해제 pending + 팔로워 → 승인, 푸시 없음, 자기 만료일에서 연장 (건별 승인과 동일)
{
  const ownExpires = inclusiveKstPeriodEndsAt(new Date('2026-09-27T03:00:00.000Z'), bonusDays)
  const result = plan({
    pendingRows: [pending('a', 'u1', 'alice', true)],
    handleSet: followers(['alice']),
    userBonusRows: [
      { id: 'a', user_id: 'u1', status: 'pending', expires_at: ownExpires.toISOString(), manually_unlocked: true },
    ],
  })
  assert.equal(result.approvals.length, 1)
  assert.equal(result.approvals[0].notify, false)
  assert.equal(
    result.approvals[0].expires_at,
    extendKstPeriodEndsAt(ownExpires, bonusDays).toISOString()
  )
}

// 3) 수동 해제인데 팔로워 목록에 없음 → 불일치 회수 (목록이 충분히 클 때만)
{
  const rows = [pending('m', 'u2', 'mallory', true), pending('l', 'u3', 'locked_only', false)]
  assert.deepEqual(plan({ pendingRows: rows, handleSet: followers() }).mismatchIds, ['m'])
  assert.deepEqual(plan({ pendingRows: rows, handleSet: buildFollowerHandleSet(['x']) }).mismatchIds, [])
}

// 4) 같은 아이디가 이미 승인돼 있으면 건너뜀 (불일치도 아님)
{
  const result = plan({
    pendingRows: [pending('a', 'u1', 'alice', true)],
    handleSet: followers(['alice']),
    approvedHandles: ['alice'],
  })
  assert.equal(result.approvals.length, 0)
  assert.equal(result.skippedHandleTaken, 1)
  assert.deepEqual(result.mismatchIds, [])
}

// 5) 같은 아이디를 두 유저가 신청 → 먼저 신청한 1건만 승인 (unique 위반 방지)
{
  const result = plan({
    pendingRows: [
      pending('late', 'u2', 'alice', false, '2026-09-27T05:00:00.000Z'),
      pending('early', 'u1', 'alice', false, '2026-09-27T01:00:00.000Z'),
    ],
    handleSet: followers(['alice']),
  })
  assert.deepEqual(result.approvals.map(a => a.id), ['early'])
  assert.equal(result.skippedHandleTaken, 1)
}

// 6) 한 유저가 아이디 2개 → 둘 다 승인, 푸시는 1회, 두 번째는 첫 번째 만료일에서 연장
{
  const result = plan({
    pendingRows: [
      pending('a1', 'u1', 'one', false, '2026-09-27T01:00:00.000Z'),
      pending('a2', 'u1', 'two', false, '2026-09-27T02:00:00.000Z'),
    ],
    handleSet: followers(['one', 'two']),
  })
  assert.equal(result.approvals.length, 2)
  assert.deepEqual(result.approvals.map(a => a.notify), [true, false])
  const first = new Date(result.approvals[0].expires_at)
  assert.equal(result.approvals[1].expires_at, calculateNewExpiresAt(first, bonusDays, now).toISOString())
}

// 7) 구매 만료일이 더 늦으면 그 뒤로 이어 붙임
{
  const purchaseExpires = '2026-10-20T14:59:59.999Z'
  const result = plan({
    pendingRows: [pending('a', 'u1', 'alice', false)],
    handleSet: followers(['alice']),
    orders: { u1: { order_number: 'o1', used_at: '2026-09-20T00:00:00.000Z', expires_at: purchaseExpires } },
  })
  assert.equal(
    result.approvals[0].expires_at,
    calculateNewExpiresAt(new Date(purchaseExpires), bonusDays, now).toISOString()
  )
}

// 8) 주문 중 만료일이 가장 늦은 건 (null은 뒤로)
{
  const latest = pickLatestOrder([
    { order_number: 'a', used_at: '2026-01-01', expires_at: null },
    { order_number: 'b', used_at: '2026-01-01', expires_at: '2026-10-01T00:00:00Z' },
    { order_number: 'c', used_at: '2026-01-01', expires_at: '2026-09-01T00:00:00Z' },
  ])
  assert.equal(latest?.order_number, 'b')
}

console.log('instagram follow match plan: ok')
