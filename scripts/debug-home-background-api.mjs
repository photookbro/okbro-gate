import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function readEnv() {
  try {
    return fs.readFileSync('.env.local', 'utf8')
  } catch {
    return ''
  }
}

const env = readEnv()
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const url = envVal('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = envVal('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !serviceKey) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const keys = ['home_background_image_url', 'home_background_position']

const { data, error } = await admin.from('settings').select('key, value').in('key', keys)

console.log('settings query error:', error?.message ?? null)
console.log('settings rows:', data)

for (const row of data ?? []) {
  const value = row.value
  console.log(`key=${row.key} type=${typeof value} value=${JSON.stringify(value)}`)
  if (typeof value === 'string') {
    console.log(`  trim ok: ${value.trim()}`)
  } else if (value != null) {
    console.log('  WARNING: non-string value would break .trim()')
  }
}

const ports = [3000, 3003]
for (const port of ports) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/home-background`)
    const body = await res.text()
    console.log(`GET :${port}/api/home-background ->`, res.status, body.slice(0, 300))
  } catch (err) {
    console.log(`GET :${port}/api/home-background skipped:`, err.message)
  }
}
