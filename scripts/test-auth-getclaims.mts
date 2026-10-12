/**
 * 미들웨어·API 인증이 /auth/v1/user 를 부르지 않고 토큰 서명을 로컬 검증하는지 확인.
 * 가짜 Supabase(JWKS) 서버 + 실제 next dev 서버(포트 3100)를 띄워 요청 수를 셈. 운영 DB 사용 안 함.
 * 다른 next dev 가 같은 폴더에서 돌고 있으면 먼저 꺼야 함.
 *
 * npx tsx scripts/test-auth-getclaims.mts
 */
import assert from 'node:assert/strict'
import { spawn, execSync } from 'node:child_process'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const NEXT_PORT = 3100
const KID = 'test-key-1'

const b64url = (input: Uint8Array | string) =>
  Buffer.from(typeof input === 'string' ? input : Buffer.from(input)).toString('base64url')

const ecdsa = { name: 'ECDSA', namedCurve: 'P-256' } as const
const realKey = await crypto.subtle.generateKey(ecdsa, true, ['sign', 'verify'])
const forgedKey = await crypto.subtle.generateKey(ecdsa, true, ['sign', 'verify'])
const publicJwk = { ...(await crypto.subtle.exportKey('jwk', realKey.publicKey)), kid: KID, alg: 'ES256', use: 'sig' }

const counts = { authUser: 0, jwks: 0, other: [] as string[] }

const fake = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname === '/auth/v1/.well-known/jwks.json') {
    counts.jwks++
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ keys: [publicJwk] }))
    return
  }
  if (url.pathname === '/auth/v1/user') counts.authUser++
  else counts.other.push(`${req.method} ${url.pathname}`)
  res.writeHead(401, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ message: 'not available in test' }))
})
await new Promise<void>(resolve => fake.listen(0, '127.0.0.1', resolve))
const supabaseUrl = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`

async function signJwt(privateKey: CryptoKey, payload: Record<string, unknown>) {
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: KID }))
  const body = b64url(JSON.stringify(payload))
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${header}.${body}`)
  )
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`
}

const now = Math.floor(Date.now() / 1000)
const userId = '44444444-4444-4444-8444-444444444444'
const claims = {
  sub: userId,
  role: 'authenticated',
  aud: 'authenticated',
  email: 'runner@example.com',
  app_metadata: { provider: 'google', terms_agreed_version: 'v1' },
  user_metadata: {},
  is_anonymous: false,
  iat: now,
  exp: now + 3600,
  iss: `${supabaseUrl}/auth/v1`,
  session_id: '55555555-5555-4555-8555-555555555555',
}
const validToken = await signJwt(realKey.privateKey, claims)
const forgedToken = await signJwt(forgedKey.privateKey, claims)

function sessionCookie(accessToken: string) {
  const session = {
    access_token: accessToken,
    refresh_token: 'test-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: claims.email, app_metadata: claims.app_metadata, user_metadata: {}, created_at: new Date().toISOString() },
  }
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  return `${storageKey}=base64-${b64url(JSON.stringify(session))}`
}

const next = spawn('npx', ['next', 'dev', '--turbopack', '-p', String(NEXT_PORT)], {
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let nextLog = ''
next.stdout.on('data', d => (nextLog += d))
next.stderr.on('data', d => (nextLog += d))

function stopNext() {
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${next.pid} /T /F`, { stdio: 'ignore' })
    else next.kill('SIGTERM')
  } catch {
    // already stopped
  }
}

async function request(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`http://localhost:${NEXT_PORT}${path}`, { headers, redirect: 'manual' })
  return { status: res.status, location: res.headers.get('location') ?? '', body: await res.text() }
}

try {
  for (let i = 0; ; i++) {
    if (i > 120) throw new Error(`next dev did not start:\n${nextLog}`)
    try {
      await fetch(`http://localhost:${NEXT_PORT}/favicon.ico`)
      break
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const results: Record<string, string> = {}

  const pageValid = await request('/mypage', { cookie: sessionCookie(validToken) })
  results['page /mypage, 정상 쿠키'] = String(pageValid.status)
  assert.equal(pageValid.status, 200, '정상 토큰이면 로그인 페이지로 보내지 않음')

  const pageForged = await request('/mypage', { cookie: sessionCookie(forgedToken) })
  results['page /mypage, 위조 쿠키'] = `${pageForged.status} ${pageForged.location}`
  assert.equal(pageForged.status, 307)
  assert.ok(pageForged.location.includes('/login'), '위조 토큰은 로그인으로')

  const apiCookie = await request('/api/terms-agree', { cookie: sessionCookie(validToken) })
  results['api terms-agree, 정상 쿠키'] = `${apiCookie.status} ${apiCookie.body}`
  assert.equal(apiCookie.status, 200)
  assert.equal(JSON.parse(apiCookie.body).agreed, true)

  const apiBearer = await request('/api/terms-agree', { authorization: `Bearer ${validToken}` })
  results['api terms-agree, 정상 Bearer'] = `${apiBearer.status} ${apiBearer.body}`
  assert.equal(apiBearer.status, 200)

  const apiForged = await request('/api/terms-agree', { authorization: `Bearer ${forgedToken}` })
  results['api terms-agree, 위조 Bearer'] = String(apiForged.status)
  assert.equal(apiForged.status, 401, '위조 토큰은 거부')

  const apiNone = await request('/api/terms-agree')
  results['api terms-agree, 로그인 없음'] = String(apiNone.status)
  assert.equal(apiNone.status, 401)

  for (let i = 0; i < 5; i++) {
    const again = await request('/api/terms-agree', { cookie: sessionCookie(validToken) })
    assert.equal(again.status, 200)
  }

  console.log(JSON.stringify({ results, auth_v1_user_calls: counts.authUser, jwks_fetches: counts.jwks, other_supabase_calls: counts.other }, null, 2))
  assert.equal(counts.authUser, 0, '/auth/v1/user 호출 0회')
  console.log('auth getClaims: ok')
} finally {
  stopNext()
  fake.close()
}
