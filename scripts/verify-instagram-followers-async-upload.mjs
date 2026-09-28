/**
 * 인스타 팔로워 비동기 업로드 검증 (실제 followers_1/2)
 * node scripts/verify-instagram-followers-async-upload.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const FOLLOWERS_DIR =
  process.env.FOLLOWERS_DIR ??
  path.join(
    process.env.USERPROFILE ?? '',
    'Downloads',
    'instagram-photo_ok_bro-2026-09-01-O3zqNqZk',
    'connections',
    'followers_and_following'
  )

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i)] = v
  }
  return env
}

async function sleep(ms) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

const env = loadEnv()
const adminToken = env.ADMIN_PASSWORD
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const file1 = path.join(FOLLOWERS_DIR, 'followers_1.html')
const file2 = path.join(FOLLOWERS_DIR, 'followers_2.html')
if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
  console.error('Missing follower HTML files:', { file1, file2 })
  process.exit(1)
}

const { error: tableProbe } = await admin
  .from('instagram_follower_upload_jobs')
  .select('id')
  .limit(1)
if (tableProbe) {
  console.error('jobs table missing — run migration first:', tableProbe.message)
  process.exit(1)
}

const form = new FormData()
form.append(
  'file',
  new Blob([fs.readFileSync(file1)], { type: 'text/html' }),
  'followers_1.html'
)
form.append(
  'file',
  new Blob([fs.readFileSync(file2)], { type: 'text/html' }),
  'followers_2.html'
)

const started = Date.now()
const acceptRes = await fetch(`${BASE}/api/admin/instagram-followers`, {
  method: 'POST',
  headers: { 'x-admin-token': adminToken },
  body: form,
})
const acceptMs = Date.now() - started
const acceptData = await acceptRes.json()

if (!acceptRes.ok) {
  console.log(JSON.stringify({ acceptOk: false, acceptMs, acceptData }, null, 2))
  process.exit(1)
}

const jobId = acceptData.job?.job_id
let finalJob = acceptData.job
let polls = 0
let completedAtMs = null
const deadline = Date.now() + 8 * 60 * 1000
const pushInFlight = job => job?.push_status === 'pending' || job?.push_status === 'sending'

while (
  finalJob &&
  (finalJob.status === 'queued' ||
    finalJob.status === 'processing' ||
    (finalJob.status === 'completed' && pushInFlight(finalJob))) &&
  Date.now() < deadline
) {
  if (finalJob.status === 'completed' && completedAtMs === null) {
    completedAtMs = Date.now() - started
  }
  await sleep(2000)
  polls++
  const statusRes = await fetch(
    `${BASE}/api/admin/instagram-followers?job_id=${encodeURIComponent(jobId)}`,
    { headers: { 'x-admin-token': adminToken } }
  )
  const statusData = await statusRes.json()
  finalJob = statusData.job
}
if (finalJob?.status === 'completed' && completedAtMs === null) {
  completedAtMs = Date.now() - started
}

async function selectAllPages(fetchPage) {
  const rows = []
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + 999)
    if (error) throw error
    if (!data || data.length === 0) return rows
    rows.push(...data)
  }
}

// 불일치 표시된 대기 신청 중 아이디가 팔로워 목록에 있는 건(오탐)이 남아 있으면 안 됨
const [flaggedRows, followerRows] = await Promise.all([
  selectAllPages((from, to) =>
    admin
      .from('instagram_follow_bonus')
      .select('id, instagram_handle')
      .eq('status', 'pending')
      .eq('manual_unlock_verified_mismatch', true)
      .order('id', { ascending: true })
      .range(from, to)
  ),
  selectAllPages((from, to) =>
    admin
      .from('instagram_followers')
      .select('username')
      .order('username', { ascending: true })
      .range(from, to)
  ),
])
const followerSet = new Set(followerRows.map(row => row.username.trim().toLowerCase()))
const remainingFalseMismatch = flaggedRows.filter(row =>
  followerSet.has(row.instagram_handle.trim().toLowerCase())
)
const { data: approvedTaken } = remainingFalseMismatch.length
  ? await admin
      .from('instagram_follow_bonus')
      .select('instagram_handle')
      .eq('status', 'approved')
      .in('instagram_handle', remainingFalseMismatch.map(row => row.instagram_handle.trim()))
  : { data: [] }
const takenSet = new Set((approvedTaken ?? []).map(row => row.instagram_handle))
const remainingRecoverable = remainingFalseMismatch.filter(
  row => !takenSet.has(row.instagram_handle.trim())
)

const report = {
  acceptOk: acceptRes.ok && acceptData.accepted === true,
  acceptMs,
  acceptUnder15s: acceptMs < 15_000,
  jobId,
  polls,
  finalStatus: finalJob?.status ?? null,
  totalParsed: finalJob?.total_parsed ?? null,
  newCount: finalJob?.new_count ?? null,
  updatedCount: finalJob?.updated_count ?? null,
  phase: finalJob?.phase ?? null,
  mismatchSweep: finalJob?.mismatch_sweep ?? null,
  mismatchSweepSkipMessage: finalJob?.mismatch_sweep_skip_message ?? null,
  matchedApproved: finalJob?.matched_approved ?? null,
  manualUnlockMismatches: finalJob?.manual_unlock_mismatches ?? null,
  pushStatus: finalJob?.push_status ?? null,
  pushSent: finalJob?.push_sent ?? null,
  pushFailed: finalJob?.push_failed ?? null,
  noSubscription: finalJob?.no_subscription ?? null,
  mismatchPushSent: finalJob?.mismatch_push_sent ?? null,
  mismatchPushFailed: finalJob?.mismatch_push_failed ?? null,
  mismatchNoSubscription: finalJob?.mismatch_no_subscription ?? null,
  summary: finalJob?.summary ?? null,
  error: finalJob?.error ?? null,
  completedAtMs,
  elapsedMs: Date.now() - started,
  flaggedMismatchPending: flaggedRows.length,
  falseMismatchInFollowers: remainingFalseMismatch.length,
  falseMismatchHandleTaken: remainingFalseMismatch.length - remainingRecoverable.length,
  falseMismatchRecoverableLeft: remainingRecoverable.length,
  falseMismatchSample: remainingRecoverable.slice(0, 10).map(row => row.instagram_handle),
  pass: false,
}

report.pass =
  report.acceptOk &&
  report.acceptUnder15s &&
  finalJob?.status === 'completed' &&
  finalJob?.phase === 'done' &&
  (finalJob?.total_parsed ?? 0) >= 10000 &&
  typeof finalJob?.matched_approved === 'number' &&
  typeof finalJob?.manual_unlock_mismatches === 'number' &&
  finalJob?.push_status === 'done' &&
  finalJob?.mismatch_sweep === 'run' &&
  report.falseMismatchRecoverableLeft === 0

console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
