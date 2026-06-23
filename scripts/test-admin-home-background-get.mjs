import fs from 'node:fs'

function readEnv(key) {
  const env = fs.readFileSync('.env.local', 'utf8')
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const token = readEnv('ADMIN_PASSWORD')
if (!token) {
  console.error('Missing ADMIN_PASSWORD in .env.local')
  process.exit(1)
}

const port = process.argv[2] ?? '3001'
const baseUrl = `http://127.0.0.1:${port}`

const res = await fetch(`${baseUrl}/api/admin/home-background`, {
  headers: { 'x-admin-token': token },
})
const body = await res.text()
console.log('GET /api/admin/home-background ->', res.status, body.slice(0, 400))

const resNoAuth = await fetch(`${baseUrl}/api/admin/home-background`)
console.log('GET without token ->', resNoAuth.status)
