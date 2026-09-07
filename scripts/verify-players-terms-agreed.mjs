/**
 * PLAYERS 약관 동의 표시 vs DB 일치 검증
 * node scripts/verify-players-terms-agreed.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i)] = v
  }
  return env
}

async function fetchAllTerms(admin) {
  const pageSize = 1000
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('terms_agreements')
      .select('user_id, agreed_at')
      .range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
    from += pageSize
  }
  return rows
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const termsRows = await fetchAllTerms(admin)
const termsUserIds = new Set(termsRows.filter(r => r.agreed_at).map(r => r.user_id))

const res = await fetch(`${BASE}/api/admin/players`, {
  headers: { 'x-admin-token': env.ADMIN_PASSWORD },
})
const data = await res.json()
const players = data.players ?? []
const recent = [...players]
  .sort((a, b) => String(b.joined_at).localeCompare(String(a.joined_at)))
  .slice(0, 40)

const mismatches = []
for (const p of recent) {
  const dbAgreed = termsUserIds.has(p.id)
  if (Boolean(p.terms_agreed) !== dbAgreed) {
    mismatches.push({
      email: p.email,
      api: p.terms_agreed,
      db: dbAgreed,
    })
  }
}

const report = {
  ok: res.ok,
  termsCount: termsRows.length,
  playersCount: players.length,
  recentTrue: recent.filter(p => p.terms_agreed).length,
  recentFalse: recent.filter(p => !p.terms_agreed).length,
  mismatchCount: mismatches.length,
  mismatches: mismatches.slice(0, 10),
  sampleRecent: recent.slice(0, 8).map(p => ({
    email: p.email,
    api: p.terms_agreed,
    db: termsUserIds.has(p.id),
  })),
  pass: false,
}

report.pass = res.ok && report.mismatchCount === 0

console.log(JSON.stringify(report, null, 2))
if (!report.pass) process.exit(1)
