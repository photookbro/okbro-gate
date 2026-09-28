/**
 * 대조 일괄 처리 검증 (가짜 Supabase, 운영 DB 사용 안 함)
 * - 운영 규모(자동승인 대기 919 + 불일치 473, pending 1,000건 초과)에서 건수·페이지 잘림·재실행 중복 확인
 * - 예전 건별 방식과 DB 호출 수 비교
 *
 * NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-instagram-follow-match-bulk.mts
 */
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  approveInstagramFollowPendingRow,
  matchPendingInstagramFollowClaims,
} from '../src/lib/instagram-follow-approve-server.ts'
import {
  previewInstagramFalseMismatchRecovery,
  recoverInstagramFalseMismatches,
} from '../src/lib/instagram-follow-false-mismatch-server.ts'
import { decideMismatchSweep } from '../src/lib/instagram-follow-match-plan.ts'

const MAX_ROWS = 1000 // Supabase PostgREST 기본 max_rows
const ASSUMED_RTT_MS = 40 // Vercel↔Supabase 같은 리전 PostgREST 1회 왕복 가정
const ASSUMED_PUSH_HTTP_MS = 150 // 웹푸시 서비스 1회 발송 가정

type Row = Record<string, unknown>
type Db = Record<string, Row[]>

let callCount = 0

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private op: 'select' | 'update' | 'insert' = 'select'
  private filters: Array<(row: Row) => boolean> = []
  private orderCol: string | null = null
  private orderAsc = true
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private limitN: number | null = null
  private mode: 'many' | 'maybeSingle' | 'single' = 'many'
  private head = false
  private returning = false
  private payload: Row | Row[] | null = null

  constructor(private db: Db, private table: string) {}

  select(_cols?: string, opts?: { head?: boolean }) {
    if (this.op === 'select') this.head = Boolean(opts?.head)
    else this.returning = true
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.payload = values
    return this
  }
  insert(values: Row | Row[]) {
    this.op = 'insert'
    this.payload = values
    return this
  }
  eq(col: string, v: unknown) {
    this.filters.push(r => r[col] === v)
    return this
  }
  in(col: string, values: unknown[]) {
    const set = new Set(values)
    this.filters.push(r => set.has(r[col]))
    return this
  }
  lt(col: string, v: string) {
    this.filters.push(r => String(r[col]) < v)
    return this
  }
  or(expr: string) {
    assert.equal(expr, 'status.eq.approved,and(status.eq.pending,manually_unlocked.eq.true)')
    this.filters.push(
      r => r.status === 'approved' || (r.status === 'pending' && r.manually_unlocked === true)
    )
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col
    this.orderAsc = opts?.ascending !== false
    return this
  }
  range(from: number, to: number) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }
  limit(n: number) {
    this.limitN = n
    return this
  }
  maybeSingle() {
    this.mode = 'maybeSingle'
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }

  private matching(): Row[] {
    return (this.db[this.table] ?? []).filter(row => this.filters.every(f => f(row)))
  }

  private execute(): { data: unknown; error: unknown; count?: number | null } {
    callCount++
    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!]
      for (const row of rows) {
        if (
          this.table === 'instagram_handle_bonus_history' &&
          this.db[this.table].some(r => r.instagram_handle === row.instagram_handle)
        ) {
          return { data: null, error: { code: '23505', message: 'duplicate' } }
        }
        this.db[this.table].push({ ...row })
      }
      return { data: null, error: null }
    }

    if (this.op === 'update') {
      const rows = this.matching()
      for (const row of rows) {
        if (this.table === 'instagram_follow_bonus' && this.payload!.status === 'approved') {
          const taken = this.db.instagram_follow_bonus.some(
            r => r !== row && r.status === 'approved' && r.instagram_handle === row.instagram_handle
          )
          if (taken) return { data: null, error: { code: '23505', message: 'handle approved' } }
        }
        Object.assign(row, this.payload)
      }
      return this.shape(rows)
    }

    let rows = this.matching()
    if (this.head) return { data: null, error: null, count: rows.length }
    if (this.orderCol) {
      const col = this.orderCol
      rows = [...rows].sort((a, b) => {
        const av = a[col] == null ? '' : String(a[col])
        const bv = b[col] == null ? '' : String(b[col])
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    if (this.rangeFrom != null) rows = rows.slice(this.rangeFrom, this.rangeTo! + 1)
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    return this.shape(rows.slice(0, MAX_ROWS))
  }

  private shape(rows: Row[]) {
    if (this.op === 'update' && !this.returning) return { data: null, error: null }
    if (this.mode === 'many') return { data: rows.map(r => ({ ...r })), error: null }
    if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
    if (this.mode === 'single' && rows.length === 0) {
      return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    }
    return { data: rows[0] ? { ...rows[0] } : null, error: null }
  }

  then<T1, T2>(
    onFulfilled?: ((value: { data: unknown; error: unknown; count?: number | null }) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled, onRejected)
  }
}

function applyApprovalsRpc(db: Db, jobId: string, rows: Row[]) {
  const updated: Row[] = []
  for (const input of rows) {
    const bonus = db.instagram_follow_bonus.find(r => r.id === input.id && r.status === 'pending')
    if (!bonus) continue
    const taken = db.instagram_follow_bonus.some(
      r => r !== bonus && r.status === 'approved' && r.instagram_handle === bonus.instagram_handle
    )
    if (taken) continue
    Object.assign(bonus, {
      status: 'approved',
      approved_at: input.approved_at,
      bonus_days_granted: input.bonus_days_granted,
      expires_at: input.expires_at,
      manually_unlocked: false,
      manual_unlock_verified_mismatch: false,
    })
    updated.push({ ...input, user_id: bonus.user_id })
  }
  for (const u of updated) {
    if (!u.history_handle) continue
    const existing = db.instagram_handle_bonus_history.find(h => h.instagram_handle === u.history_handle)
    if (existing) existing.confirm_count = Number(existing.confirm_count) + 1
    else db.instagram_handle_bonus_history.push({ instagram_handle: u.history_handle, confirm_count: 1 })
  }
  for (const u of updated.filter(r => r.notify)) {
    const dup = db.instagram_follow_push_outbox.some(
      o => o.job_id === jobId && o.user_id === u.user_id && o.kind === 'approved'
    )
    if (!dup) db.instagram_follow_push_outbox.push({ job_id: jobId, user_id: u.user_id, kind: 'approved', status: 'pending' })
  }
  return updated.map(u => ({ approved_id: u.id, approved_user_id: u.user_id }))
}

function applyMismatchRpc(db: Db, jobId: string, ids: string[]) {
  const idSet = new Set(ids)
  const updated = db.instagram_follow_bonus.filter(
    r => idSet.has(String(r.id)) && r.status === 'pending' && r.manually_unlocked === true
  )
  for (const row of updated) {
    row.manually_unlocked = false
    row.manual_unlock_verified_mismatch = true
    row.updated_at = FLAGGED_AT
    const dup = db.instagram_follow_push_outbox.some(
      o => o.job_id === jobId && o.user_id === row.user_id && o.kind === 'mismatch'
    )
    if (!dup) db.instagram_follow_push_outbox.push({ job_id: jobId, user_id: row.user_id, kind: 'mismatch', status: 'pending' })
  }
  return updated.map(r => ({ revoked_id: r.id, revoked_user_id: r.user_id }))
}

const FLAGGED_AT = '2026-09-28T02:10:30.000Z'

function fakeClient(db: Db): SupabaseClient {
  return {
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    from: (table: string) => new FakeQuery(db, table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      callCount++
      if (name === 'apply_instagram_follow_approvals') {
        return { data: applyApprovalsRpc(db, String(args.p_job_id), args.p_rows as Row[]), error: null }
      }
      if (name === 'apply_instagram_follow_mismatch_revokes') {
        return { data: applyMismatchRpc(db, String(args.p_job_id), args.p_ids as string[]), error: null }
      }
      throw new Error(`unknown rpc ${name}`)
    },
  } as unknown as SupabaseClient
}

const now = new Date('2026-09-28T02:10:00.000Z')
const pad = (n: number) => String(n).padStart(5, '0')

function buildDataset() {
  const db: Db = {
    settings: [
      { key: 'instagram_follow_bonus_days', value: '5' },
      { key: 'verified_period_days', value: '30' },
    ],
    instagram_follow_bonus: [],
    orders: [],
    instagram_handle_bonus_history: [],
    instagram_follow_push_outbox: [],
    instagram_followers: [],
    push_subscriptions: [],
  }
  const followers: string[] = []
  for (let i = 0; i < 11_609; i++) followers.push(`follower_${pad(i)}`)
  db.instagram_followers = followers.map(username => ({ username }))

  const activeExpires = '2026-10-01T14:59:59.999Z'
  let seq = 0
  const addPending = (handle: string, manual: boolean) => {
    seq++
    db.instagram_follow_bonus.push({
      id: `b-${pad(seq)}`,
      user_id: `u-${pad(seq)}`,
      instagram_handle: handle,
      status: 'pending',
      manually_unlocked: manual,
      manual_unlock_verified_mismatch: false,
      expires_at: manual ? activeExpires : null,
      created_at: new Date(Date.UTC(2026, 8, 20, 0, 0, seq)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 8, 20, 0, 0, seq)).toISOString(),
    })
  }

  // 자동승인 대기 919: 수동 해제 850 + 잠김 69 (팔로워 목록에 있음)
  for (let i = 0; i < 850; i++) addPending(followers[i], true)
  for (let i = 850; i < 919; i++) addPending(followers[i], false)
  // 불일치 473: 수동 해제인데 팔로워 목록에 없음
  for (let i = 0; i < 473; i++) addPending(`not_following_${pad(i)}`, true)
  // 팔로워 아님 + 잠김 200: 변화 없음
  for (let i = 0; i < 200; i++) addPending(`locked_stranger_${pad(i)}`, false)
  // 이미 다른 유저가 승인한 아이디로 재신청 5
  for (let i = 0; i < 5; i++) {
    const handle = followers[5000 + i]
    db.instagram_follow_bonus.push({
      id: `approved-${i}`,
      user_id: `owner-${i}`,
      instagram_handle: handle,
      status: 'approved',
      manually_unlocked: false,
      manual_unlock_verified_mismatch: false,
      expires_at: activeExpires,
      created_at: '2026-09-01T00:00:00.000Z',
    })
    addPending(handle, true)
  }
  // 일부 유저는 구매 이력 있음
  for (let i = 1; i <= 300; i++) {
    db.orders.push({
      id: `o-${pad(i)}`,
      user_id: `u-${pad(i)}`,
      order_number: `2026092000${pad(i)}`,
      used_at: '2026-09-20T00:00:00.000Z',
      created_at: '2026-09-20T00:00:00.000Z',
      expires_at: i % 2 === 0 ? '2026-10-19T14:59:59.999Z' : null,
    })
  }
  return { db, followers }
}

const counts = (db: Db) => ({
  pending: db.instagram_follow_bonus.filter(r => r.status === 'pending').length,
  approved: db.instagram_follow_bonus.filter(r => r.status === 'approved').length,
  outboxApproved: db.instagram_follow_push_outbox.filter(r => r.kind === 'approved').length,
  outboxMismatch: db.instagram_follow_push_outbox.filter(r => r.kind === 'mismatch').length,
})

// ---- 새 방식 ----
const { db, followers } = buildDataset()
const admin = fakeClient(db)

const pendingBefore = counts(db).pending
assert.ok(pendingBefore > MAX_ROWS, 'pending 이 max_rows 를 넘어야 페이지 잘림을 검증할 수 있음')
const { data: capped } = await admin.from('instagram_follow_bonus').select('id').eq('status', 'pending')
assert.equal((capped as Row[]).length, MAX_ROWS, '예전 방식(range 없는 select)은 1000건에서 잘림')

callCount = 0
const started = performance.now()
const first = await matchPendingInstagramFollowClaims(admin, followers, {
  jobId: 'job-1',
  sweepMismatches: true,
  now,
})
const newCpuMs = performance.now() - started
const newCalls = callCount
const afterFirst = counts(db)

assert.equal(first.approved, 919)
assert.equal(first.manual_unlock_mismatches, 473)
assert.equal(first.skipped_handle_taken, 5)
assert.equal(afterFirst.outboxApproved, 69, '잠김 상태에서 승인된 유저만 승인 푸시 적재')
assert.equal(afterFirst.outboxMismatch, 473)
assert.equal(db.instagram_handle_bonus_history.length, 919)

// 재실행(같은 파일 재업로드) → 이미 처리된 건은 다시 승인/회수/적재되지 않음
callCount = 0
const second = await matchPendingInstagramFollowClaims(admin, followers, {
  jobId: 'job-2',
  sweepMismatches: true,
  now,
})
const rerunCalls = callCount
const afterSecond = counts(db)
assert.equal(second.approved, 0)
assert.equal(second.manual_unlock_mismatches, 0)
assert.equal(afterSecond.outboxApproved, afterFirst.outboxApproved)
assert.equal(afterSecond.outboxMismatch, afterFirst.outboxMismatch)

// ---- 부분 업로드(followers_2만) 재발 방지 ----
const partialFollowers = followers.slice(10_000) // 1,609건
const partialDecision = decideMismatchSweep({
  fileCount: 1,
  totalParsed: partialFollowers.length,
  baselineTotal: followers.length,
})
assert.equal(partialDecision.sweep, false)
{
  const guarded = buildDataset()
  const guardedResult = await matchPendingInstagramFollowClaims(
    fakeClient(guarded.db),
    partialFollowers,
    { jobId: 'job-partial', sweepMismatches: partialDecision.sweep, now }
  )
  assert.equal(guardedResult.manual_unlock_mismatches, 0, '부분 목록은 회수하지 않음')
  assert.equal(guarded.db.instagram_follow_push_outbox.length, 0)
}

// ---- 오탐 복구: 예전처럼 부분 목록으로 회수가 돌아간 상태 재현 → 미리보기 → 복구 → 전체 재업로드 ----
const incident = buildDataset()
const incidentAdmin = fakeClient(incident.db)
const incidentRun = await matchPendingInstagramFollowClaims(incidentAdmin, partialFollowers, {
  jobId: 'job-incident',
  sweepMismatches: true,
  now,
})
// 수동 해제 850(팔로워) + 473(비팔로워) + 5(아이디 선점) 모두 회수됨
assert.equal(incidentRun.manual_unlock_mismatches, 1328)
// 회수 전부터 구독이 있던 사용자 100명 + 회수 뒤 구독한 사용자 20명
for (let i = 1; i <= 120; i++) {
  incident.db.push_subscriptions.push({
    id: `s-${pad(i)}`,
    user_id: `u-${pad(i)}`,
    created_at: i <= 100 ? '2026-09-25T00:00:00.000Z' : '2026-09-28T02:30:00.000Z',
  })
}

const preview = await previewInstagramFalseMismatchRecovery(incidentAdmin, now)
assert.equal(preview.flagged_total, 1328)
assert.equal(preview.in_followers, 855, '팔로워 목록에 있는 오탐 850 + 아이디 선점 5')
assert.equal(preview.recoverable, 850)
assert.equal(preview.handle_taken, 5)
assert.equal(preview.push_likely_users, 100)

const outboxBeforeRecovery = incident.db.instagram_follow_push_outbox.length
const recovery = await recoverInstagramFalseMismatches(
  incidentAdmin,
  preview.candidates.filter(row => !row.handle_taken).map(row => row.id),
  now
)
assert.deepEqual(recovery, { requested: 850, recovered: 850, skipped: 0 })
assert.equal(incident.db.instagram_follow_push_outbox.length, outboxBeforeRecovery, '복구는 푸시 적재 없음')
assert.equal(
  incident.db.instagram_follow_bonus.filter(
    r => r.status === 'approved' && r.manual_unlock_verified_mismatch === false && String(r.id).startsWith('b-')
  ).length,
  850
)
const recoveryAgain = await recoverInstagramFalseMismatches(
  incidentAdmin,
  preview.candidates.map(row => row.id),
  now
)
assert.equal(recoveryAgain.recovered, 0, '복구 재실행은 변화 없음')

// 전체 목록 재업로드 → 잠긴 69건 승인, 이미 회수된 473건은 다시 회수·푸시되지 않음
const fullAfterRecovery = await matchPendingInstagramFollowClaims(incidentAdmin, followers, {
  jobId: 'job-full-after-recovery',
  sweepMismatches: true,
  now,
})
assert.equal(fullAfterRecovery.approved, 69)
assert.equal(fullAfterRecovery.manual_unlock_mismatches, 0)
assert.equal(fullAfterRecovery.skipped_handle_taken, 5)

// ---- 예전 건별 방식 (DB 호출 수만 비교, 푸시는 구독 조회 1회 + HTTP 로 계산) ----
const legacy = buildDataset()
const legacyAdmin = fakeClient(legacy.db)
callCount = 0
const handleSet = new Set(legacy.followers.map(u => u.toLowerCase()))
const legacyPending = legacy.db.instagram_follow_bonus
  .filter(r => r.status === 'pending')
  .slice(0, MAX_ROWS) as Array<{ id: string; user_id: string; instagram_handle: string; manually_unlocked: boolean }>
let legacyApproved = 0
let legacyApprovalPushes = 0
let legacyApproveErrors = 0
for (const row of legacyPending) {
  if (!handleSet.has(row.instagram_handle.toLowerCase())) continue
  try {
    const approved = await approveInstagramFollowPendingRow(legacyAdmin, row, 5, 30, now)
    if (approved) {
      legacyApproved++
      if (!row.manually_unlocked) legacyApprovalPushes++
    }
  } catch {
    legacyApproveErrors++
  }
}
const legacyApproveCalls = callCount
const legacyMismatch = legacyPending.filter(
  r => r.manually_unlocked && !handleSet.has(r.instagram_handle.toLowerCase())
).length

// 예전 승인 1건: 핸들 확인 → 혜택 2건 병렬 → 주문 → update → 이력 조회 → 이력 쓰기 = 순차 6회
const legacyApproveRounds = legacyApproved * 6
const legacyPushSeconds =
  (legacyApprovalPushes + legacyMismatch) * (ASSUMED_RTT_MS + ASSUMED_PUSH_HTTP_MS) / 1000
const legacyMismatchSeconds = (legacyMismatch * ASSUMED_RTT_MS) / 1000
const legacySeconds =
  (legacyApproveRounds * ASSUMED_RTT_MS) / 1000 + legacyMismatchSeconds + legacyPushSeconds
const allMismatch = afterFirst.outboxMismatch
const legacyAllRowsSeconds =
  (legacyApproveRounds * ASSUMED_RTT_MS +
    allMismatch * ASSUMED_RTT_MS +
    (legacyApprovalPushes + allMismatch) * (ASSUMED_RTT_MS + ASSUMED_PUSH_HTTP_MS)) /
  1000

console.log(
  JSON.stringify(
    {
      dataset: { pending: pendingBefore, followers: followers.length },
      new: {
        approved: first.approved,
        mismatches: first.manual_unlock_mismatches,
        skipped_handle_taken: first.skipped_handle_taken,
        outbox_approved: afterFirst.outboxApproved,
        outbox_mismatch: afterFirst.outboxMismatch,
        db_calls: newCalls,
        est_seconds_at_40ms_rtt: (newCalls * ASSUMED_RTT_MS) / 1000,
        cpu_ms: Math.round(newCpuMs),
        rerun: { approved: second.approved, mismatches: second.manual_unlock_mismatches, db_calls: rerunCalls },
      },
      false_mismatch_recovery: {
        incident_revoked: incidentRun.manual_unlock_mismatches,
        preview: {
          flagged_total: preview.flagged_total,
          in_followers: preview.in_followers,
          recoverable: preview.recoverable,
          handle_taken: preview.handle_taken,
          push_likely_users: preview.push_likely_users,
        },
        recovered: recovery.recovered,
        full_reupload_after: fullAfterRecovery,
      },
      legacy: {
        pending_seen_due_to_1000_cap: legacyPending.length,
        approved: legacyApproved,
        approve_errors: legacyApproveErrors,
        mismatches_seen: legacyMismatch,
        approve_db_calls: legacyApproveCalls,
        est_seconds_at_40ms_rtt: Math.round(legacySeconds),
        est_seconds_if_all_473_mismatches_seen: Math.round(legacyAllRowsSeconds),
      },
    },
    null,
    2
  )
)
console.log('instagram follow match bulk: ok')
