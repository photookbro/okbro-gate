/**
 * 인스타 수동 승인 a~g 프로덕션 실검증
 * node scripts/verify-instagram-manual-approve-prod.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, '.tmp-checklist', 'verify-instagram-manual-prod')
const BASE = process.env.VERIFY_BASE_URL ?? 'https://www.okbrogate.com'

const USERS = {
  manual: {
    email: 'ig-manual-prod@okbro.internal',
    password: 'PwIgManualProd2026!',
    name: 'IG수동검증',
  },
  approved: {
    email: 'ig-approved-prod@okbro.internal',
    password: 'PwIgApprovedProd2026!',
    name: 'IG승인검증',
  },
  auto: {
    email: 'ig-auto-prod@okbro.internal',
    password: 'PwIgAutoProd2026!',
    name: 'IG자동검증',
  },
}

function loadEnv() {
  const env = {}
  for (const file of ['.env.local', '.env.vercel.tmp']) {
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

async function ensurePlaywright() {
  try {
    return require('playwright')
  } catch {
    await new Promise((resolve, reject) => {
      const p = spawn('npm', ['install', '--no-save', 'playwright'], {
        cwd: root,
        shell: true,
        stdio: 'inherit',
      })
      p.on('exit', code => (code === 0 ? resolve() : reject(new Error('playwright install failed'))))
    })
    await new Promise((resolve, reject) => {
      const p = spawn('npx', ['playwright', 'install', 'chromium'], {
        cwd: root,
        shell: true,
        stdio: 'inherit',
      })
      p.on('exit', code => (code === 0 ? resolve() : reject(new Error('chromium install failed'))))
    })
    return require('playwright')
  }
}

async function ensureUser(admin, spec) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  let user = list?.users?.find(u => u.email === spec.email)
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { full_name: spec.name },
    })
    if (error) throw error
    user = data.user
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: spec.password })
  }
  return user
}

async function signIn(env, email, password) {
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw error ?? new Error(`signIn failed: ${email}`)
  const jar = []
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: toSet => {
        for (const c of toSet) {
          const i = jar.findIndex(x => x.name === c.name)
          const row = { name: c.name, value: c.value, ...c.options }
          if (i >= 0) jar[i] = row
          else jar.push(row)
        }
      },
    },
  })
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
  return { jar, accessToken: data.session.access_token, userId: data.user.id }
}

function toPlaywrightCookies(jar) {
  return jar.map(c => ({
    name: c.name,
    value: c.value,
    domain: '.okbrogate.com',
    path: c.path ?? '/',
    secure: true,
    sameSite: 'Lax',
    httpOnly: c.httpOnly ?? false,
  }))
}

async function adminFetch(adminToken, pathname, init = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: {
      'x-admin-token': adminToken,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { res, data }
}

async function findGpsEvent(admin) {
  const { data: events } = await admin
    .from('events')
    .select(
      'id, name, is_pay_event, gps_enabled, album_b_url, gps_1_lat, gps_1_lng, gps_lat, gps_lng'
    )
    .eq('gps_enabled', true)
    .not('album_b_url', 'is', null)

  const nonPay = (events ?? []).find(e => e.is_pay_event !== true && (e.gps_1_lat ?? e.gps_lat))
  if (nonPay) return nonPay
  return (events ?? []).find(e => e.gps_1_lat ?? e.gps_lat) ?? null
}

async function getPlayer(adminToken, userId) {
  const { res, data } = await adminFetch(adminToken, `/api/admin/players?user_id=${userId}`)
  if (!res.ok) throw new Error(`players detail failed: ${data.error ?? res.status}`)
  return data.player ?? data
}

async function uploadFollowersHtml(adminToken, handles) {
  const links = handles.map(h => `<a href="https://www.instagram.com/${h}/">x</a>`).join('')
  const html = `<html><body>${links}</body></html>`
  const form = new FormData()
  form.append('file', new Blob([html], { type: 'text/html' }), `followers_${Date.now()}.html`)
  const res = await fetch(`${BASE}/api/admin/instagram-followers`, {
    method: 'POST',
    headers: { 'x-admin-token': adminToken },
    body: form,
  })
  const data = await res.json()
  return { res, data }
}

async function loginAdmin(page, adminToken) {
  await page.addInitScript(token => {
    sessionStorage.setItem('admin_token', token)
  }, adminToken)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 90_000 })
  const loginInput = page.getByPlaceholder('비밀번호')
  if (await loginInput.isVisible().catch(() => false)) {
    await loginInput.fill(adminToken)
    await page.getByRole('button', { name: '입장' }).click()
    await page.waitForSelector('button:has-text("PLAYERS")', { timeout: 30_000 })
  }
}

async function dismissBlockingModals(page) {
  for (let i = 0; i < 6; i++) {
    const overlays = page.locator('.modal-overlay')
    if ((await overlays.count()) === 0) return
    const top = overlays.last()
    for (const name of ['LATER', '허용하기', '사이트에 있는 동안 허용', '나중에']) {
      const btn = top.getByRole('button', { name })
      if (await btn.count()) {
        await btn.click({ force: true })
        await page.waitForTimeout(400)
        break
      }
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
}

function onboardingInitScript(userId) {
  return ({ uid }) => {
    localStorage.setItem('terms_agreed_v1', 'true')
    localStorage.setItem('okbro_app_first_launch_done', '1')
    localStorage.setItem('okbro_permission_notification_asked', '1')
    localStorage.setItem('okbro_onboarding_verification_skipped', '1')
    localStorage.setItem('okbro_permission_gps_ack', '1')
    localStorage.setItem('okbro_event_detail_permission_recheck_done', '1')
    if (uid) localStorage.setItem(`okbro_instagram_follow_onboarding_done_${uid}`, '1')
  }
}

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return name + '.png'
}

async function screenshotPlayersRow(page, adminToken, email, filename) {
  await loginAdmin(page, adminToken)
  await page.getByRole('button', { name: 'PLAYERS' }).click()
  await page.waitForSelector('table tbody tr', { timeout: 30_000 })
  const row = page.locator('table tbody tr', { hasText: email })
  await row.waitFor({ timeout: 30_000 })
  await row.scrollIntoViewIfNeeded()
  const rowText = (await row.innerText()).replace(/\s+/g, ' ').trim()
  await row.screenshot({ path: path.join(outDir, filename) })
  const oxCell = row.locator('td').nth(6)
  const oxFile = filename.replace('.png', '-ox.png')
  await oxCell.screenshot({ path: path.join(outDir, oxFile) })
  return {
    rowText,
    oxText: (await oxCell.innerText()).trim(),
    hasManualBadge: rowText.includes('수동 승인'),
    hasMismatch: rowText.includes('대조 결과 팔로워 목록에 없음'),
    hasInstantApproveButton: (await row.getByRole('button', { name: '즉시 승인' }).count()) > 0,
    screenshots: [filename, oxFile],
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const env = loadEnv()
  const adminToken = env.ADMIN_PASSWORD
  if (!adminToken) throw new Error('ADMIN_PASSWORD missing')

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const report = {
    baseUrl: BASE,
    timestamp: new Date().toISOString(),
    migrationApplied: false,
    event: null,
    checks: {},
    screenshots: [],
    details: {},
  }

  const { error: schemaError } = await admin
    .from('instagram_follow_bonus')
    .select('manually_unlocked, manual_unlock_verified_mismatch')
    .limit(1)
  report.migrationApplied = !schemaError
  if (!report.migrationApplied) {
    report.checks = { migration: { pass: false, note: schemaError?.message } }
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
    throw new Error(`Migration not applied: ${schemaError?.message}`)
  }

  const gpsEvent = await findGpsEvent(admin)
  if (!gpsEvent) throw new Error('No GPS-enabled event with album_b_url found')
  report.event = { id: gpsEvent.id, name: gpsEvent.name, is_pay_event: gpsEvent.is_pay_event }

  const manualUser = await ensureUser(admin, USERS.manual)
  const approvedUser = await ensureUser(admin, USERS.approved)
  const autoUser = await ensureUser(admin, USERS.auto)

  for (const uid of [manualUser.id, approvedUser.id, autoUser.id]) {
    await admin.from('instagram_follow_bonus').delete().eq('user_id', uid)
    await admin.from('orders').delete().eq('user_id', uid)
    await admin.from('terms_agreements').upsert(
      { user_id: uid, version: 'v1', agreed_at: new Date().toISOString() },
      { onConflict: 'user_id,version' }
    )
  }

  const handleManual = `ig_manual_${Date.now().toString(36).slice(-6)}`
  const handleAuto = `ig_auto_${Date.now().toString(36).slice(-6)}`
  const handleApproved = `ig_appr_${Date.now().toString(36).slice(-6)}`
  const nowIso = new Date().toISOString()

  await admin.from('instagram_follow_bonus').insert({
    user_id: manualUser.id,
    instagram_handle: `@${handleManual}`,
    status: 'pending',
    updated_at: nowIso,
  })

  await admin.from('instagram_follow_bonus').insert({
    user_id: approvedUser.id,
    instagram_handle: `@${handleApproved}`,
    status: 'approved',
    approved_at: nowIso,
    bonus_days_granted: 14,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    updated_at: nowIso,
  })

  await admin.from('instagram_follow_bonus').insert({
    user_id: autoUser.id,
    instagram_handle: `@${handleAuto}`,
    status: 'pending',
    updated_at: nowIso,
  })

  const playwright = await ensurePlaywright()
  const browser = await playwright.chromium.launch({ headless: true })

  // a: pending → 즉시 승인 버튼 노출
  const playerPending = await getPlayer(adminToken, manualUser.id)
  report.details.a_pending_player = playerPending
  const checkA = {
    pass:
      playerPending.instagram_follow_pending === true &&
      playerPending.instagram_can_manual_approve === true,
  }
  report.checks.a_pending_button_visible = checkA

  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const uiA = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.manual.email,
    'a-pending-button.png'
  )
  report.details.a_ui = uiA
  report.screenshots.push(...uiA.screenshots)
  checkA.pass = checkA.pass && uiA.hasInstantApproveButton

  // b: 즉시 승인 → 기간 + GPS + 앨범
  const manualRes = await adminFetch(adminToken, '/api/admin/players/instagram-manual-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: manualUser.id }),
  })
  const { data: afterManualRow } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', manualUser.id)
    .single()

  const sessionManual = await signIn(env, USERS.manual.email, USERS.manual.password)
  const statusRes = await fetch(
    `${BASE}/api/verify-order/status?event_id=${gpsEvent.id}`,
    {
      headers: { Authorization: `Bearer ${sessionManual.accessToken}` },
    }
  )
  const statusData = await statusRes.json()

  const mypageRes = await fetch(`${BASE}/api/mypage`, {
    headers: { Authorization: `Bearer ${sessionManual.accessToken}` },
  })
  const mypageData = await mypageRes.json()

  const userContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: {
      latitude: gpsEvent.gps_1_lat ?? gpsEvent.gps_lat ?? 37.5665,
      longitude: gpsEvent.gps_1_lng ?? gpsEvent.gps_lng ?? 126.978,
    },
    permissions: ['geolocation'],
  })
  await userContext.addCookies(toPlaywrightCookies(sessionManual.jar))
  await userContext.addInitScript(onboardingInitScript(manualUser.id), { uid: manualUser.id })
  const eventPage = await userContext.newPage()
  await eventPage.goto(`${BASE}/events/${gpsEvent.id}`, { waitUntil: 'networkidle', timeout: 90_000 })
  await dismissBlockingModals(eventPage)
  await eventPage.waitForSelector('text=촬영 감지', { timeout: 30_000 }).catch(() => null)

  const gpsSwitch = eventPage.getByRole('switch').first()
  const gpsDisabled = await gpsSwitch.getAttribute('aria-disabled')
  const bodyText = await eventPage.locator('body').innerText()
  const hasLockedAlbum = bodyText.includes('구매 인증 후 이용') || bodyText.includes('인증이 필요')
  const hasAlbumAccess =
    bodyText.includes('사진 보러가기') ||
    bodyText.includes('고화질') ||
    bodyText.includes('앨범')

  report.screenshots.push(await shot(eventPage, 'b-event-after-manual-unlock'))
  report.screenshots.push(await shot(eventPage, 'b-mypage-placeholder'))

  const mypagePage = await userContext.newPage()
  await mypagePage.goto(`${BASE}/mypage`, { waitUntil: 'networkidle', timeout: 90_000 })
  await dismissBlockingModals(mypagePage)
  report.screenshots.push(await shot(mypagePage, 'b-mypage-benefit'))

  report.checks.b_manual_unlock_effects = {
    pass:
      manualRes.res.ok &&
      afterManualRow?.status === 'pending' &&
      afterManualRow?.manually_unlocked === true &&
      !!afterManualRow?.expires_at &&
      statusData.instagram_follow_verified === true &&
      statusData.gps_tracking_eligible === true &&
      gpsDisabled !== 'true' &&
      !hasLockedAlbum &&
      hasAlbumAccess,
    manualApi: manualRes.data,
    afterManualRow,
    statusData,
    mypageInstagram: mypageData?.instagram_follow ?? mypageData?.instagram,
    gpsDisabled,
    hasLockedAlbum,
    hasAlbumAccess,
  }

  const uiB = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.manual.email,
    'b-after-manual-unlock-players.png'
  )
  report.details.b_ui = uiB
  report.screenshots.push(...uiB.screenshots)

  // c: approved → 버튼 없음
  const playerApproved = await getPlayer(adminToken, approvedUser.id)
  const uiC = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.approved.email,
    'c-approved-no-button.png'
  )
  report.checks.c_approved_no_button = {
    pass:
      playerApproved.instagram_can_manual_approve === false &&
      !uiC.hasInstantApproveButton,
    playerApproved,
    ui: uiC,
  }
  report.screenshots.push(...uiC.screenshots)

  // d: 수동 승인 + HTML 포함 → 정상 승인
  const matchD = await uploadFollowersHtml(adminToken, [handleManual, handleAuto, handleApproved])
  const { data: afterMatchRow } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', manualUser.id)
    .single()

  const uiG = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.manual.email,
    'g-after-match-clean-o.png'
  )
  report.checks.d_manual_in_html_match = {
    pass:
      matchD.res.ok &&
      afterMatchRow?.status === 'approved' &&
      afterMatchRow?.manually_unlocked === false &&
      afterMatchRow?.manual_unlock_verified_mismatch === false,
    upload: matchD.data,
    afterMatchRow,
  }
  report.checks.g_players_clean_o = {
    pass:
      !uiG.hasManualBadge &&
      !uiG.hasMismatch &&
      !uiG.hasInstantApproveButton &&
      uiG.oxText === 'O',
    ui: uiG,
  }
  report.screenshots.push(...uiG.screenshots)

  // e: mismatch — 새 pending + 수동 승인 후 handle 빼고 업로드
  const handleMismatch = `ig_mis_${Date.now().toString(36).slice(-6)}`
  await admin.from('instagram_follow_bonus').delete().eq('user_id', manualUser.id)
  await admin.from('instagram_follow_bonus').insert({
    user_id: manualUser.id,
    instagram_handle: `@${handleMismatch}`,
    status: 'pending',
    updated_at: nowIso,
  })
  await adminFetch(adminToken, '/api/admin/players/instagram-manual-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: manualUser.id }),
  })
  const mismatchUpload = await uploadFollowersHtml(adminToken, ['someone_else_only'])
  const { data: mismatchRow } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', manualUser.id)
    .single()
  const playerMismatch = await getPlayer(adminToken, manualUser.id)
  const uiE = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.manual.email,
    'e-mismatch-warning.png'
  )
  report.checks.e_manual_omitted_mismatch = {
    pass:
      mismatchRow?.manual_unlock_verified_mismatch === true &&
      mismatchRow?.status === 'pending' &&
      (mismatchUpload.data?.manual_unlock_mismatches ?? 0) >= 1 &&
      (playerMismatch.instagram_manual_unlock_mismatch === true || uiE.hasMismatch),
    mismatchRow,
    upload: mismatchUpload.data,
    playerMismatch,
    ui: uiE,
  }
  report.screenshots.push(...uiE.screenshots)

  // f: 자동 대조 회귀 — auto user pending, HTML에 handle 포함
  await admin.from('instagram_follow_bonus').delete().eq('user_id', autoUser.id)
  await admin.from('instagram_follow_bonus').insert({
    user_id: autoUser.id,
    instagram_handle: `@${handleAuto}`,
    status: 'pending',
    updated_at: nowIso,
  })
  const matchF = await uploadFollowersHtml(adminToken, [handleAuto])
  const { data: autoRow } = await admin
    .from('instagram_follow_bonus')
    .select('*')
    .eq('user_id', autoUser.id)
    .single()
  const uiF = await screenshotPlayersRow(
    adminPage,
    adminToken,
    USERS.auto.email,
    'f-auto-match-approved.png'
  )
  report.checks.f_auto_match_regression = {
    pass:
      matchF.res.ok &&
      autoRow?.status === 'approved' &&
      (matchF.data?.approved ?? 0) >= 1,
    upload: matchF.data,
    autoRow,
    ui: uiF,
  }
  report.screenshots.push(...uiF.screenshots)

  await browser.close()

  const allPass = Object.entries(report.checks).every(([, v]) => v.pass === true)
  report.allPass = allPass
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!allPass) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
