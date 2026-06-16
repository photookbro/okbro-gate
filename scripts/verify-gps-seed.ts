/**
 * Verify GPS seed + admin API
 * Run: npx tsx scripts/verify-gps-seed.ts
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: logs } = await admin
    .from('gps_logs')
    .select('id, passed_at, notified, events(name)')
    .order('passed_at', { ascending: false })

  console.log('gps_logs:', JSON.stringify(logs, null, 2))

  const eventId = '6f7c7126-92e4-46e0-8518-baf276a07f80'
  const pw = process.env.ADMIN_PASSWORD ?? ''
  const res = await fetch(
    `http://localhost:3003/api/admin/gps-logs?event_id=${encodeURIComponent(eventId)}`,
    { headers: { 'x-admin-token': pw } }
  )
  console.log('admin api status:', res.status)
  console.log(await res.text())
}

main().catch(console.error)
