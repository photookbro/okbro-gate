import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

function formatTimeInputValue(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 6)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
}

function isCompleteTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

function buildPassedAtFromEventDate(eventDate, passedTime) {
  return `${eventDate}T${passedTime}+09:00`
}

assert.equal(formatTimeInputValue('143245'), '14:32:45')
assert.equal(isCompleteTime('14:32:45'), true)
console.log('time-input: ok')

const env = fs.readFileSync('.env.local', 'utf8')
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const admin = createClient(envVal('NEXT_PUBLIC_SUPABASE_URL'), envVal('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: event } = await admin.from('events').select('id, name, date').limit(1).maybeSingle()
assert.ok(event, 'event required')

const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
const userId = authUsers?.users?.[0]?.id
assert.ok(userId, 'user required')

const passedTime = '16:20:10'
assert.ok(isCompleteTime(passedTime))
const passed_at = buildPassedAtFromEventDate(event.date, passedTime)

await admin.from('gps_logs').delete().eq('event_id', event.id).eq('user_id', userId).eq('passed_at', passed_at)

const { data: inserted, error } = await admin
  .from('gps_logs')
  .insert({ user_id: userId, event_id: event.id, passed_at, notified: false })
  .select('id, passed_at')
  .single()

assert.ifError(error)
assert.ok(inserted?.id)

const { data: logs } = await admin
  .from('gps_logs')
  .select('id, passed_at')
  .eq('event_id', event.id)
  .eq('user_id', userId)
  .eq('passed_at', passed_at)

assert.equal(logs?.length, 1)
console.log('supabase gps_logs insert:', inserted.id, passed_at)
console.log('admin gps-logs DB: ok')

const token = envVal('ADMIN_PASSWORD')
if (token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('http://127.0.0.1:3003/api/admin/gps-logs', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify({
        event_id: event.id,
        user_id: userId,
        passed_time: '17:05:00',
      }),
    })
    const body = await res.json()
    console.log('HTTP POST:', res.status, body.log?.passed_at_display ?? body.error)
    if (res.status === 200) console.log('admin gps-logs HTTP: ok')
  } catch (err) {
    console.log('HTTP POST skipped (dev server unavailable):', err.name)
  } finally {
    clearTimeout(timer)
  }
}
