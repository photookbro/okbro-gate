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
const deadline = Date.now() + 4 * 60 * 1000

while (
  finalJob &&
  (finalJob.status === 'queued' || finalJob.status === 'processing') &&
  Date.now() < deadline
) {
  await sleep(2000)
  polls++
  const statusRes = await fetch(
    `${BASE}/api/admin/instagram-followers?job_id=${encodeURIComponent(jobId)}`,
    { headers: { 'x-admin-token': adminToken } }
  )
  const statusData = await statusRes.json()
  finalJob = statusData.job
}

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
  summary: finalJob?.summary ?? null,
  error: finalJob?.error ?? null,
  elapsedMs: Date.now() - started,
  pass: false,
}

report.pass =
  report.acceptOk &&
  report.acceptUnder15s &&
  finalJob?.status === 'completed' &&
  (finalJob?.total_parsed ?? 0) >= 10000

console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
