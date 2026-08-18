/**
 * One-off: count users missing terms agreement (KST today + overall).
 * Usage: node --env-file=.env.local scripts/count-unsigned-terms.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function kstDayStartIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const d = parts.find(p => p.type === 'day')?.value
  // KST midnight = UTC previous day 15:00
  return new Date(`${y}-${m}-${d}T00:00:00+09:00`).toISOString()
}

const since = kstDayStartIso()
const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (usersError) {
  console.error('listUsers failed:', usersError.message)
  process.exit(1)
}

const { data: agreements, error: agError } = await admin
  .from('terms_agreements')
  .select('user_id, agreed_at, version')

if (agError) {
  console.error('terms_agreements query failed:', agError.message)
  process.exit(1)
}

const agreedIds = new Set((agreements ?? []).map(row => row.user_id))
const allUsers = users.users ?? []
const todayUsers = allUsers.filter(u => u.created_at && u.created_at >= since)
const todayUnsigned = todayUsers.filter(u => !agreedIds.has(u.id))
const allUnsigned = allUsers.filter(u => !agreedIds.has(u.id))

console.log(
  JSON.stringify(
    {
      since_kst: since,
      listed_users: allUsers.length,
      terms_rows: agreements?.length ?? 0,
      today_joined: todayUsers.length,
      today_joined_unsigned: todayUnsigned.length,
      all_unsigned: allUnsigned.length,
    },
    null,
    2
  )
)
