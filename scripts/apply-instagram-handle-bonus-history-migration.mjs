/**
 * Apply supabase/migrations/20260907_instagram_handle_bonus_history.sql
 * Usage: node scripts/apply-instagram-handle-bonus-history-migration.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dns from 'node:dns/promises'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260907_instagram_handle_bonus_history.sql'),
  'utf8'
)

function loadEnv() {
  const env = {}
  for (const file of ['.env.local', '.env.production.tmp']) {
    const p = path.join(root, file)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue
      const i = line.indexOf('=')
      if (i < 0) continue
      const key = line.slice(0, i)
      if (env[key]) continue
      let v = line.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      env[key] = v
    }
  }
  return env
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { error: checkError } = await admin
  .from('instagram_handle_bonus_history')
  .select('instagram_handle')
  .limit(1)

if (!checkError) {
  console.log('OK: table already exists')
  const { count } = await admin
    .from('instagram_handle_bonus_history')
    .select('*', { count: 'exact', head: true })
  console.log('history rows:', count)
  process.exit(0)
}

console.log('table missing:', checkError.message)

const passwords = [
  ...new Set(
    [env.SUPABASE_DB_PASSWORD, env.POSTGRES_PASSWORD, env.DATABASE_PASSWORD].filter(Boolean)
  ),
]
if (passwords.length === 0) {
  console.error('FAIL: no DB password in env — run SQL in Supabase SQL Editor:')
  console.error(path.join(root, 'supabase/migrations/20260907_instagram_handle_bonus_history.sql'))
  process.exit(1)
}

const regions = [
  'ap-northeast-2',
  'ap-northeast-1',
  'ap-southeast-1',
  'us-east-1',
  'eu-west-1',
]
const prefixes = ['aws-0', 'aws-1']
const projectRef = 'ucwdxqmkqooxefzcmavh'

for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`
    let ips = []
    try {
      ips = await dns.resolve4(host)
    } catch {
      continue
    }
    for (const ip of ips.slice(0, 2)) {
      for (const password of passwords) {
        for (const port of [5432, 6543]) {
          for (const user of [`postgres.${projectRef}`, 'postgres']) {
            const client = new pg.Client({
              host: ip,
              port,
              user,
              password,
              database: 'postgres',
              ssl: { rejectUnauthorized: false },
              connectionTimeoutMillis: 8000,
            })
            try {
              await client.connect()
              await client.query(sql)
              await client.end()
              console.log('OK: migration applied via', host, port, user)
              process.exit(0)
            } catch (err) {
              try {
                await client.end()
              } catch {
                // ignore
              }
            }
          }
        }
      }
    }
  }
}

console.error('FAIL: could not apply via pg — paste SQL in Supabase Dashboard SQL Editor')
process.exit(1)
