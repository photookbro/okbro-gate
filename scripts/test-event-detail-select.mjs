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
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const id = '6f7c7126-92e4-46e0-8518-baf276a07f80'

const full = await supabase
  .from('events')
  .select(
    'id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_1_lat, gps_1_lng, gps_1_radius_meters, gps_2_lat, gps_2_lng, gps_2_radius_meters, gps_lat, gps_lng, gps_radius_meters'
  )
  .eq('id', id)
  .single()

console.log('full select error:', full.error?.message)
console.log('full select data:', full.data?.name)

const legacy = await supabase
  .from('events')
  .select('id, name, date, album_a_url, album_b_url, gps_enabled, is_loop_course, gps_lat, gps_lng, gps_radius_meters')
  .eq('id', id)
  .single()

console.log('legacy select error:', legacy.error?.message)
console.log('legacy select data:', legacy.data?.name)
