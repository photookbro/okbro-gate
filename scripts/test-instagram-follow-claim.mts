/**
 * 아이디 제출(자동승인 제한) 흐름 검증 — 가짜 Supabase, 운영 DB 사용 안 함
 * DB 트리거(회수 표시 → 계정 기록, 아이디 변경 → 중복 표시 해제)는 가짜 update 에서 같은 규칙으로 흉내냄
 *
 * NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-instagram-follow-claim.mts
 */
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { submitInstagramFollowClaim } from '../src/lib/instagram-follow-claim-server.ts'
import { manuallyUnlockInstagramFollowPendingRow } from '../src/lib/instagram-follow-approve-server.ts'
import { decideInstagramClaimAutoAction } from '../src/lib/instagram-claim-auto-action.ts'
import { instagramFollowAwaitingCheckNotice } from '../src/lib/instagram-follow-copy.ts'

type Row = Record<string, unknown>
type Db = Record<string, Row[]>

let seq = 0
const nextId = () => `id-${++seq}`

function likeToRegExp(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\' && i + 1 < pattern.length) {
      out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    } else if (ch === '%') out += '.*'
    else if (ch === '_') out += '.'
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}

/** migrations 20260928_instagram_handle_taken_revoke / _resubmit_auto_unlock_block 트리거와 같은 규칙 */
function applyBonusTriggers(db: Db, before: Row, after: Row) {
  if (
    after.manual_unlock_handle_taken &&
    (after.instagram_handle !== before.instagram_handle ||
      after.status !== 'pending' ||
      (after.manually_unlocked && !before.manually_unlocked))
  ) {
    after.manual_unlock_handle_taken = false
  }
  if (
    (after.manual_unlock_verified_mismatch && !before.manual_unlock_verified_mismatch) ||
    (after.manual_unlock_handle_taken && !before.manual_unlock_handle_taken)
  ) {
    const profile = db.profiles.find(p => p.user_id === after.user_id)
    if (profile && !profile.instagram_auto_unlock_blocked_at) {
      profile.instagram_auto_unlock_blocked_at = new Date().toISOString()
    }
  }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private op: 'select' | 'update' | 'insert' = 'select'
  private filters: Array<(row: Row) => boolean> = []
  private orderCol: string | null = null
  private orderAsc = true
  private limitN: number | null = null
  private mode: 'many' | 'maybeSingle' = 'many'
  private returning = false
  private payload: Row | null = null

  constructor(private db: Db, private table: string) {}

  select() {
    if (this.op !== 'select') this.returning = true
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.payload = values
    return this
  }
  insert(values: Row) {
    this.op = 'insert'
    this.payload = values
    return this
  }
  eq(col: string, v: unknown) {
    this.filters.push(r => r[col] === v)
    return this
  }
  neq(col: string, v: unknown) {
    this.filters.push(r => r[col] !== v)
    return this
  }
  in(col: string, values: unknown[]) {
    const set = new Set(values)
    this.filters.push(r => set.has(r[col]))
    return this
  }
  gte(col: string, v: string | number) {
    this.filters.push(r => r[col] != null && String(r[col]) >= String(v))
    return this
  }
  ilike(col: string, pattern: string) {
    const re = likeToRegExp(pattern)
    this.filters.push(r => typeof r[col] === 'string' && re.test(r[col] as string))
    return this
  }
  not(col: string, op: string, v: unknown) {
    assert.equal(op, 'is')
    this.filters.push(r => (v === null ? r[col] != null : r[col] !== v))
    return this
  }
  or(expr: string) {
    assert.equal(expr, 'mismatch_sweep.is.null,mismatch_sweep.eq.run')
    this.filters.push(r => r.mismatch_sweep == null || r.mismatch_sweep === 'run')
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col
    this.orderAsc = opts?.ascending !== false
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

  private execute(): { data: unknown; error: unknown } {
    const table = (this.db[this.table] ??= [])
    if (this.op === 'insert') {
      const row: Row = { ...this.payload }
      if (this.table === 'instagram_follow_bonus') {
        Object.assign(
          row,
          {
            id: nextId(),
            approved_at: null,
            bonus_days_granted: null,
            expires_at: null,
            manually_unlocked: false,
            manual_unlock_verified_mismatch: false,
            manual_unlock_handle_taken: false,
            created_at: new Date(Date.UTC(2026, 8, 28, 3, 0, seq)).toISOString(),
          },
          this.payload
        )
      }
      table.push(row)
      return this.shape([row])
    }

    const rows = table.filter(row => this.filters.every(f => f(row)))

    if (this.op === 'update') {
      for (const row of rows) {
        if (this.table === 'instagram_follow_bonus' && this.payload!.status === 'approved') {
          const taken = table.some(
            r => r !== row && r.status === 'approved' && r.instagram_handle === row.instagram_handle
          )
          if (taken) return { data: null, error: { code: '23505', message: 'handle approved' } }
        }
        const before = { ...row }
        Object.assign(row, this.payload)
        if (this.table === 'instagram_follow_bonus') applyBonusTriggers(this.db, before, row)
      }
      return this.returning ? this.shape(rows) : { data: null, error: null }
    }

    let result = rows
    if (this.orderCol) {
      const col = this.orderCol
      result = [...result].sort((a, b) => {
        const av = a[col] == null ? '' : String(a[col])
        const bv = b[col] == null ? '' : String(b[col])
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    if (this.limitN != null) result = result.slice(0, this.limitN)
    return this.shape(result)
  }

  private shape(rows: Row[]) {
    if (this.mode === 'many') return { data: rows.map(r => ({ ...r })), error: null }
    if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
    return { data: rows[0] ? { ...rows[0] } : null, error: null }
  }

  then<T1, T2>(
    onFulfilled?: ((value: { data: unknown; error: unknown }) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled, onRejected)
  }
}

const SNAPSHOT_AT = '2026-09-27T10:00:00.000Z'
const now = new Date('2026-09-28T03:00:00.000Z')

function buildDb(): Db {
  const users = ['normal', 'mismatched', 'mismatched2', 'consumer', 'blocked_consumer', 'buyer', 'taken_user']
  return {
    settings: [
      { key: 'instagram_follow_bonus_days', value: '5' },
      { key: 'verified_period_days', value: '30' },
    ],
    profiles: users.map(id => ({
      user_id: id,
      first_created_at: '2026-09-01T00:00:00.000Z',
      instagram_auto_unlock_blocked_at: null,
    })),
    instagram_follow_bonus: [],
    instagram_handle_bonus_history: [
      { instagram_handle: 'refollow_id', confirm_count: 1, last_confirmed_user_id: 'someone_before' },
    ],
    instagram_followers: [
      { username: 'real_follower', updated_at: SNAPSHOT_AT },
      { username: 'refollow_id', updated_at: SNAPSHOT_AT },
      { username: 'unfollowed_id', updated_at: '2026-09-01T10:00:00.000Z' },
      { username: 'axb', updated_at: SNAPSHOT_AT },
    ],
    instagram_follower_upload_jobs: [
      {
        id: 'job-full',
        status: 'completed',
        file_count: 2,
        total_parsed: 11_609,
        mismatch_sweep: 'run',
        created_at: SNAPSHOT_AT,
      },
    ],
    orders: [
      {
        user_id: 'buyer',
        order_number: 'ORDER-1',
        used_at: '2026-09-20T00:00:00.000Z',
        created_at: '2026-09-20T00:00:00.000Z',
        expires_at: '2026-10-19T14:59:59.999Z',
      },
    ],
  }
}

function fakeClient(db: Db): SupabaseClient {
  return { from: (table: string) => new FakeQuery(db, table) } as unknown as SupabaseClient
}

const db = buildDb()
const admin = fakeClient(db)
const submit = (userId: string, handle: string) =>
  submitInstagramFollowClaim(admin, { id: userId, created_at: '2026-09-01T00:00:00.000Z' }, handle, now)
const latestRow = (userId: string) =>
  [...db.instagram_follow_bonus]
    .filter(r => r.user_id === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
const status = (result: { body: Record<string, unknown> }) =>
  result.body.status as { state: string; mismatch_revoked?: boolean; handle_taken_revoked?: boolean }

/** 업로드 대조의 불일치 회수(apply_instagram_follow_mismatch_revokes)와 같은 변경 */
function revokeAsMismatch(userId: string) {
  const row = latestRow(userId)
  const before = { ...row }
  Object.assign(row, { manually_unlocked: false, manual_unlock_verified_mismatch: true })
  applyBonusTriggers(db, before, row)
}

const blockedAt = (userId: string) =>
  db.profiles.find(p => p.user_id === userId)?.instagram_auto_unlock_blocked_at ?? null

// 0) 판정 규칙
assert.equal(decideInstagramClaimAutoAction({ handleConsumed: false, autoUnlockBlocked: false, inCurrentFollowers: false }), 'unlock')
assert.equal(decideInstagramClaimAutoAction({ handleConsumed: false, autoUnlockBlocked: true, inCurrentFollowers: true }), 'approve')
assert.equal(decideInstagramClaimAutoAction({ handleConsumed: false, autoUnlockBlocked: true, inCurrentFollowers: false }), 'pending')
assert.equal(decideInstagramClaimAutoAction({ handleConsumed: true, autoUnlockBlocked: true, inCurrentFollowers: true }), 'pending')
assert.equal(decideInstagramClaimAutoAction({ handleConsumed: true, autoUnlockBlocked: false, inCurrentFollowers: false }), 'pending')

const report: Record<string, unknown> = {}

// 1) 최초 제출 → 자동승인(바로 열림), 회수 이력 없는 계정은 추가 아이디도 기존처럼 자동승인
{
  const first = await submit('normal', 'Normal_First')
  assert.equal(first.httpStatus, 200)
  assert.equal(status(first).state, 'active')
  assert.equal(latestRow('normal').manually_unlocked, true)
  assert.equal(latestRow('normal').status, 'pending')
  report.first_submit = { state: status(first).state, message: first.body.message }
}

// 2) 불일치 회수 후 → 최신 팔로워 목록에 있는 아이디로 재제출 → 즉시 승인 확정
{
  await submit('mismatched', 'typo_id')
  assert.equal(latestRow('mismatched').manually_unlocked, true)
  revokeAsMismatch('mismatched')
  assert.ok(blockedAt('mismatched'), '불일치 회수 시 계정에 기록')

  // 같은 아이디 그대로 재제출(목록에 없음) → 다시 열리지 않음 (예전에는 여기서 자동승인됐음)
  const same = await submit('mismatched', 'typo_id')
  assert.equal(same.httpStatus, 200)
  assert.equal(latestRow('mismatched').manually_unlocked, false)
  assert.equal(status(same).state, 'pending')
  assert.equal(same.body.message, instagramFollowAwaitingCheckNotice())

  const fixed = await submit('mismatched', 'real_follower')
  assert.equal(fixed.httpStatus, 200)
  const row = latestRow('mismatched')
  assert.equal(row.status, 'approved')
  assert.equal(row.instagram_handle, 'real_follower')
  assert.equal(row.manually_unlocked, false)
  assert.equal(status(fixed).state, 'active')
  assert.ok(
    db.instagram_handle_bonus_history.some(h => h.instagram_handle === 'real_follower'),
    '즉시 승인은 확정 이력으로 남음 (재팔로우 반복 방지)'
  )
  report.mismatch_then_listed_handle = { state: status(fixed).state, row_status: row.status }
}

// 3) 불일치 회수 후 → 목록에 없는 아이디로 재제출 → 대기 (열람 없음, 대기 안내)
{
  await submit('mismatched2', 'wrong_one')
  revokeAsMismatch('mismatched2')

  const other = await submit('mismatched2', 'still_wrong')
  assert.equal(other.httpStatus, 200)
  const row = latestRow('mismatched2')
  assert.equal(row.status, 'pending')
  assert.equal(row.instagram_handle, 'still_wrong')
  assert.equal(row.manually_unlocked, false)
  assert.equal(row.manual_unlock_verified_mismatch, false)
  assert.equal(status(other).state, 'pending')
  assert.equal(status(other).mismatch_revoked, false)
  assert.equal(other.body.message, instagramFollowAwaitingCheckNotice())
  assert.ok(blockedAt('mismatched2'), '아이디를 바꿔도 계정 기록은 유지')

  // 예전 팔로워 목록에만 있고 최신 전체 목록 이후엔 없는 아이디(언팔) → 대기
  const unfollowed = await submit('mismatched2', 'unfollowed_id')
  assert.equal(latestRow('mismatched2').manually_unlocked, false)
  assert.equal(latestRow('mismatched2').status, 'pending')
  assert.equal(status(unfollowed).state, 'pending')

  // 아이디의 _ 는 한 글자 와일드카드로 취급하지 않음 (a_b ≠ axb)
  await submit('mismatched2', 'a_b')
  assert.equal(latestRow('mismatched2').status, 'pending')

  // 관리자 수동 승인(추가 승인/즉시 승인)은 그대로 동작
  const adminUnlocked = await manuallyUnlockInstagramFollowPendingRow(
    admin,
    latestRow('mismatched2') as never,
    5,
    30,
    now
  )
  assert.equal(adminUnlocked?.manually_unlocked, true)
  report.mismatch_then_unlisted_handle = { state: status(other).state, message: other.body.message }
}

// 4) 확정 이력 있는 아이디 재제출 → 대기 (기존 동작 유지) — 회수 이력 없는 계정도, 목록에 있어도
{
  const consumed = await submit('consumer', 'refollow_id')
  assert.equal(consumed.httpStatus, 200)
  assert.equal(latestRow('consumer').manually_unlocked, false)
  assert.equal(latestRow('consumer').status, 'pending')
  assert.equal(status(consumed).state, 'pending')

  await submit('blocked_consumer', 'bad_id')
  revokeAsMismatch('blocked_consumer')
  const blockedConsumed = await submit('blocked_consumer', 'refollow_id')
  assert.equal(latestRow('blocked_consumer').status, 'pending', '목록에 있어도 확정 이력이면 즉시 승인하지 않음')
  assert.equal(status(blockedConsumed).state, 'pending')
  report.consumed_handle = { state: status(consumed).state }
}

// 5) 구매 인증과 독립: 구매 유효 계정도 같은 규칙, 주문은 건드리지 않음
{
  await submit('buyer', 'buyer_fake')
  revokeAsMismatch('buyer')
  const ordersBefore = JSON.stringify(db.orders)
  const again = await submit('buyer', 'buyer_fake2')
  assert.equal(latestRow('buyer').manually_unlocked, false)
  assert.equal(status(again).state, 'pending')
  assert.equal(JSON.stringify(db.orders), ordersBefore)
}

// 6) 다른 계정 아이디로 회수된 경우도 계정 기록 → 이후 목록에 없는 아이디는 대기
{
  await submit('taken_user', 'someone_elses')
  const row = latestRow('taken_user')
  const before = { ...row }
  Object.assign(row, { manually_unlocked: false, manual_unlock_handle_taken: true })
  applyBonusTriggers(db, before, row)
  assert.ok(blockedAt('taken_user'))
  const retry = await submit('taken_user', 'not_listed')
  assert.equal(latestRow('taken_user').manual_unlock_handle_taken, false, '아이디 변경 시 중복 표시 해제')
  assert.equal(status(retry).state, 'pending')
}

// 회수 이력 없는 정상 계정은 제한 없음
assert.equal(blockedAt('normal'), null)

console.log(JSON.stringify(report, null, 2))
console.log('instagram follow claim: ok')
