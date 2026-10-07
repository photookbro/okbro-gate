/**
 * 약관 동의 확인이 terms_agreements 를 몇 번 조회하는지 측정 (가짜 Supabase HTTP 서버, 운영 DB 사용 안 함)
 * - 예전: 동의 확인이 필요한 API 호출마다 1회 조회
 * - 지금: 사용자당 최초 1회 조회 + app_metadata 기록 1회, 이후 0회
 *
 * NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-terms-agreement-claim.mts
 */
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

type FakeUser = { id: string; app_metadata: Record<string, unknown> }

const AGREED = '11111111-1111-4111-8111-111111111111'
const NEW = '22222222-2222-4222-8222-222222222222'
const users = new Map<string, FakeUser>([
  [AGREED, { id: AGREED, app_metadata: { provider: 'google', providers: ['google'] } }],
  [NEW, { id: NEW, app_metadata: { provider: 'google', providers: ['google'] } }],
])
const agreements = new Set<string>([AGREED])
const counts = { termsSelect: 0, adminUpdate: 0 }

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let body = ''
  req.on('data', chunk => (body += chunk))
  req.on('end', () => {
    if (req.method === 'GET' && url.pathname === '/rest/v1/terms_agreements') {
      counts.termsSelect++
      const userId = (url.searchParams.get('user_id') ?? '').replace(/^eq\./, '')
      const rows = agreements.has(userId) ? [{ id: `t-${userId}` }] : []
      const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(wantsObject ? (rows[0] ?? null) : rows))
      return
    }
    const adminMatch = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/)
    if (req.method === 'PUT' && adminMatch) {
      counts.adminUpdate++
      const user = users.get(adminMatch[1])
      const payload = JSON.parse(body || '{}') as { app_metadata?: Record<string, unknown> }
      if (user && payload.app_metadata) user.app_metadata = payload.app_metadata
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(user ?? {}))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: `unexpected ${req.method} ${url.pathname}` }))
  })
})

await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as AddressInfo).port
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'

const { requireTermsAgreement, hasTermsAgreement } = await import('../src/lib/terms-agreement-server.ts')
const { NextResponse } = await import('next/server')

/** getUser() 는 매 요청 인증 서버에서 최신 app_metadata 를 받아옴 */
const getUser = (id: string) => structuredClone(users.get(id)!) as never

// 홈 1회 방문 시 동의 확인이 붙는 API: track-activity, events/list, verify-order/status(배너), verify-order/status(다가오는 대회)
const HOME_VISIT_CHECKS = 4

// 예전 방식: 호출마다 DB 조회
counts.termsSelect = 0
for (let i = 0; i < HOME_VISIT_CHECKS * 3; i++) await hasTermsAgreement(AGREED)
const legacySelects = counts.termsSelect

// 새 방식: 동의한 사용자 홈 3회 방문
counts.termsSelect = 0
counts.adminUpdate = 0
for (let i = 0; i < HOME_VISIT_CHECKS * 3; i++) {
  const result = await requireTermsAgreement(getUser(AGREED))
  assert.ok(!(result instanceof NextResponse), '동의한 사용자는 통과')
}
assert.equal(counts.termsSelect, 1, '최초 1회만 조회')
assert.equal(counts.adminUpdate, 1, 'app_metadata 기록 1회')
assert.deepEqual(users.get(AGREED)!.app_metadata.providers, ['google'], '기존 app_metadata 유지')
const newSelects = counts.termsSelect

// 미동의 사용자는 매번 조회하고 403 (동의 즉시 반영돼야 하므로 기록하지 않음)
counts.termsSelect = 0
counts.adminUpdate = 0
const blocked = await requireTermsAgreement(getUser(NEW))
assert.ok(blocked instanceof NextResponse && blocked.status === 403)
assert.equal(counts.adminUpdate, 0)
agreements.add(NEW)
const nowAgreed = await requireTermsAgreement(getUser(NEW))
assert.ok(!(nowAgreed instanceof NextResponse), '동의 직후 바로 통과')
await requireTermsAgreement(getUser(NEW))
assert.equal(counts.termsSelect, 2, '미동의 1회 + 동의 확인 1회, 이후 0회')

// app_metadata 기록이 실패해도 동의 판정은 그대로
const { recordTermsAgreementClaim } = await import('../src/lib/terms-agreement-server.ts')
await recordTermsAgreementClaim({ id: 'not-a-uuid', app_metadata: {} } as never)

server.close()
console.log(
  JSON.stringify(
    {
      home_visits: 3,
      checks_per_visit: HOME_VISIT_CHECKS,
      terms_agreements_selects: { before: legacySelects, after: newSelects },
    },
    null,
    2
  )
)
console.log('terms agreement claim: ok')
