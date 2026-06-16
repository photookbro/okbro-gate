import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf8')
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const admin = createClient(envVal('NEXT_PUBLIC_SUPABASE_URL'), envVal('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: event } = await admin.from('events').select('id, date').limit(1).maybeSingle()
const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
const userId = users?.users?.[0]?.id
assert.ok(event && userId)

const passedAt = `${event.date}T16:20:10+09:00`

const { data: inserted, error } = await admin
  .from('gps_logs')
  .insert({
    user_id: userId,
    event_id: event.id,
    passed_at: passedAt,
    pass_count: 2,
    notified: false,
  })
  .select('id, pass_count')
  .single()

if (error) {
  console.error('insert failed:', error.message)
  console.error('Run supabase/migrations/20250617_gps_logs_pass_count.sql if pass_count is missing')
  process.exit(1)
}

assert.equal(inserted.pass_count, 2)
await admin.from('gps_logs').delete().eq('id', inserted.id)
console.log('gps_logs pass_count column: ok')
