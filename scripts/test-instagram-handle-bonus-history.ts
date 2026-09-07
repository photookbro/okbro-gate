/**
 * Logic checks for handle bonus history (no live account delete).
 * Usage: npx tsx scripts/test-instagram-handle-bonus-history.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  isInstagramHandleInBonusHistory,
  recordInstagramHandleBonusHistory,
} from '../src/lib/instagram-handle-bonus-history.ts'

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
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

async function main() {
  const env = loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { error: tableError } = await admin
    .from('instagram_handle_bonus_history')
    .select('instagram_handle')
    .limit(1)

  if (tableError) {
    console.error(
      'FAIL: instagram_handle_bonus_history missing. Run supabase/migrations/20260907_instagram_handle_bonus_history.sql in Supabase SQL Editor.'
    )
    console.error(tableError.message)
    process.exit(1)
  }

  const probe = `okbro_hist_probe_${Date.now()}`
  assert.equal(await isInstagramHandleInBonusHistory(admin, probe), false)

  await recordInstagramHandleBonusHistory(admin, probe, '00000000-0000-4000-8000-000000000001')
  assert.equal(await isInstagramHandleInBonusHistory(admin, probe), true)
  assert.equal(await isInstagramHandleInBonusHistory(admin, `@${probe}`), true)

  const typo = `okbro_typo_${Date.now()}`
  assert.equal(await isInstagramHandleInBonusHistory(admin, typo), false)

  await admin.from('instagram_handle_bonus_history').delete().eq('instagram_handle', probe)

  const { count: approvedCount } = await admin
    .from('instagram_follow_bonus')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  const { count: historyCount } = await admin
    .from('instagram_handle_bonus_history')
    .select('*', { count: 'exact', head: true })

  console.log('ok', {
    approvedCount,
    historyCount,
    note: 'history should be >= distinct approved handles after migration backfill',
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
