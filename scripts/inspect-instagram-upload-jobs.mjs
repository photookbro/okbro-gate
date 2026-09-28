/**
 * 인스타 팔로워 업로드 작업·대조 대상 현황 (읽기 전용)
 * node scripts/inspect-instagram-upload-jobs.mjs [job_id ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(build) {
  const { count: n, error } = await build(
    admin.from('instagram_follow_bonus').select('id', { count: 'exact', head: true })
  )
  if (error) throw error
  return n
}

const jobIds = process.argv.slice(2)
const jobQuery = admin
  .from('instagram_follower_upload_jobs')
  .select(
    'id, status, file_names, progress_index, total_parsed, matched_approved, push_sent, manual_unlock_mismatches, summary, error, created_at, started_at, finished_at, updated_at'
  )
  .order('created_at', { ascending: false })
const { data: jobs, error: jobsError } = jobIds.length
  ? await jobQuery.in('id', jobIds)
  : await jobQuery.limit(8)
if (jobsError) throw jobsError

const { count: followers, error: followersError } = await admin
  .from('instagram_followers')
  .select('username', { count: 'estimated', head: true })
if (followersError) throw followersError

const report = {
  jobs,
  instagram_followers_estimated: followers,
  bonus: {
    pending_total: await count(q => q.eq('status', 'pending')),
    pending_manual_unlocked: await count(q =>
      q.eq('status', 'pending').eq('manually_unlocked', true)
    ),
    pending_locked: await count(q =>
      q.eq('status', 'pending').eq('manually_unlocked', false)
    ),
    pending_flagged_mismatch: await count(q =>
      q.eq('status', 'pending').eq('manual_unlock_verified_mismatch', true)
    ),
    approved_total: await count(q => q.eq('status', 'approved')),
  },
}

console.log(JSON.stringify(report, null, 2))
