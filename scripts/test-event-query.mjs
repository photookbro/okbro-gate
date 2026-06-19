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

const { fetchEventById, fetchEventsList } = await import('../src/lib/event-query.ts')

const event = await fetchEventById('6f7c7126-92e4-46e0-8518-baf276a07f80')
console.log('fetchEventById error:', event.error?.message)
console.log('fetchEventById name:', event.data?.name)
console.log('album_b_url:', event.data?.album_b_url?.slice(0, 40))

const list = await fetchEventsList()
console.log('fetchEventsList error:', list.error?.message)
console.log('past count:', list.past.length)
console.log('upcoming count:', list.upcoming.length)
