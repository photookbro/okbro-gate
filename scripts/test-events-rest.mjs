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

async function test(path) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  console.log('\n---', path.slice(0, 80), '...')
  console.log('status:', res.status)
  console.log('body:', text.slice(0, 400))
}

const cutoff = '2025-06-16'
await test(
  `/events?select=id,name,date,gps_enabled,album_b_url&album_b_url=not.is.null&album_b_url=neq.&date=gte.${cutoff}&order=date.desc`
)
await test(
  `/events?select=id,name,date,gps_enabled,gps_lat,gps_lng,gps_radius_meters,is_loop_course&or=(album_b_url.is.null,album_b_url.eq.)&order=date.asc`
)
