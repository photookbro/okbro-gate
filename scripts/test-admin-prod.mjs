import fs from 'node:fs'

function readEnv(key) {
  const env = fs.readFileSync('.env.local', 'utf8')
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const token = readEnv('ADMIN_PASSWORD')
const base = process.argv[2] ?? 'https://okbro-gate.vercel.app'

for (const path of ['/api/admin/home-background', '/api/admin/settings', '/api/home-background']) {
  const headers = path.startsWith('/api/admin') ? { 'x-admin-token': token } : {}
  const res = await fetch(`${base}${path}`, { headers })
  const body = await res.text()
  console.log(`${path} -> ${res.status}`)
  console.log(body.slice(0, 300))
  console.log('---')
}
