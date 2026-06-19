import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EVENT_FIELDS =
  'id,name,date,album_a_url,album_b_url,gps_lat,gps_lng,gps_radius_meters,gps_1_lat,gps_1_lng,gps_1_radius_meters,gps_2_lat,gps_2_lng,gps_2_radius_meters,gps_enabled,is_loop_course'

const res = await fetch(`${url}/rest/v1/events?select=${EVENT_FIELDS}&order=date.desc`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
})
console.log('admin events GET status:', res.status)
console.log('body:', (await res.text()).slice(0, 200))
