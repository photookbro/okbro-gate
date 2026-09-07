/**
 * pending + manually_unlocked=false + mismatch=false 건을
 * 즉시 승인(수동해제)과 동일하게 소급 unlock.
 *
 * Usage: npx tsx scripts/backfill-instagram-pending-auto-unlock.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { backfillPendingInstagramManualUnlocks } from '../src/lib/instagram-follow-approve-server.ts'

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env.local')
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

async function main() {
  const env = loadEnvLocal()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const before = await admin
    .from('instagram_follow_bonus')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('manually_unlocked', false)
    .eq('manual_unlock_verified_mismatch', false)

  console.log('locked pending (pre):', before.count)

  const result = await backfillPendingInstagramManualUnlocks(admin)
  console.log('backfill result:', result)

  const after = await admin
    .from('instagram_follow_bonus')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('manually_unlocked', false)
    .eq('manual_unlock_verified_mismatch', false)

  console.log('locked pending (post):', after.count)
  process.exit(result.failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
