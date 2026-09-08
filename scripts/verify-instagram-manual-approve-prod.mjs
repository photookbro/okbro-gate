/**
 * 인스타 수동 승인 a~g 프로덕션 실검증 (시뮬레이션 아님)
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

async function listPlayers(adminToken) {
  const { res, data } = await adminFetch(adminToken, '/api/admin/players')
  if (!res.ok) throw new Error(`players list failed: ${data.error ?? res.status}`)
  return data.players ?? []
}

async function getPlayerDetail(adminToken, userId) {
  const { res, data } = await adminFetch(adminToken, `/api/admin/players?user_id=${userId}`)
  if (!res.ok) throw new Error(`players detail failed: ${data.error ?? res.status}`)
  return data.player
}

async function snapshotOtherManualPending(admin, testUserIds) {
  const { data } = await admin
    .from('instagram_follow_bonus')
    .select('id, user_id, instagram_handle, status, manually_unlocked, manual_unlock_verified_mismatch')
    .eq('status', 'pending')
    .eq('manually_unlocked', true)
  return (data ?? []).filter(row => !testUserIds.has(row.user_id))
}

async function restoreOtherManualPending(admin, snapshot) {
  for (const row of snapshot) {
    await admin
      .from('instagram_follow_bonus')
      .update({
        manual_unlock_verified_mismatch: row.manual_unlock_verified_mismatch === true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
  }
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
  page.removeAllListeners('dialog')
  page.on('dialog', dialog => {
    void dialog.accept()
  })
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

async function openPlayersTab(page) {
  await page.getByRole('button', { name: 'PLAYERS' }).click()
  await page.waitForSelector('table tbody tr', { timeout: 60_000 })
}

async function dismissBlockingModals(page) {
  for (let i = 0; i < 8; i++) {
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

function onboardingInitScript() {
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
  return `${name}.png`
}

async function screenshotPlayersRow(page, adminToken, email, filename) {
  await loginAdmin(page, adminToken)
  await openPlayersTab(page)
  const row = page.locator('table tbody tr', { hasText: email })
  await row.waitFor({ timeout: 60_000 })
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

async function completeTermsIfNeeded(page) {
  const agreeBtn = page.getByRole('button', { name: '동의하고 계속하기' })
  if ((await agreeBtn.count()) === 0) return false
  const boxes = page.locator('input[type="checkbox"]')
  const n = await boxes.count()
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).check({ force: true })
  }
  await agreeBtn.click()
  await page.waitForTimeout(1500)
  await page.waitForFunction(
    () => !document.body.innerText.includes('동의하고 계속하기'),
    null,
    { timeout: 20_000 }
  ).catch(() => null)
  return true
}

async function inspectGpsOnEvents(page, eventName) {
  await page.goto(`${BASE}/events`, { waitUntil: 'networkidle', timeout: 90_000 })
  await completeTermsIfNeeded(page)
  await dismissBlockingModals(page)
  await page.waitForSelector('.event-upcoming-item, text=촬영예정대회', { timeout: 30_000 }).catch(() => null)
  const item = page.locator('.event-upcoming-item').filter({ hasText: eventName }).first()
  const found = (await item.count()) > 0
  if (!found) {
    const body = await page.locator('body').innerText()
    return {
      found: false,
      gpsDisabled: null,
      hasAuthHint: body.includes('구매 인증 후 이용 가능해요'),
      bodyPreview: body.slice(0, 400),
    }
  }
  await item.scrollIntoViewIfNeeded()
  const gpsSwitch = item.getByRole('switch')
  const gpsDisabled =
    (await gpsSwitch.getAttribute('aria-disabled')) === 'true' || (await gpsSwitch.isDisabled())
  const hasAuthHint = (await item.getByText('구매 인증 후 이용 가능해요').count()) > 0
  return { found: true, gpsDisabled, hasAuthHint }
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
    events: {},
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

  const eventsRes = await fetch(`${BASE}/api/events/list`)
  const eventsData = await eventsRes.json()
  const gpsEvent = (eventsData.upcoming ?? []).find(
    e => e.is_pay_event !== true && (e.show_gps_toggle || (e.locations ?? []).length > 0)
  )
  const albumEvent = (eventsData.past ?? []).find(e => e.has_album === true && e.is_pay_event !== true)
  if (!gpsEvent) throw new Error('No non-pay upcoming GPS event found')
  if (!albumEvent) throw new Error('No non-pay past album event found')
  report.events = {
    gps: { id: gpsEvent.id, name: gpsEvent.name },
    album: { id: albumEvent.id, name: albumEvent.name },
  }

  const manualUser = await ensureUser(admin, USERS.manual)
  const approvedUser = await ensureUser(admin, USERS.approved)
  const autoUser = await ensureUser(admin, USERS.auto)
  const testUserIds = new Set([manualUser.id, approvedUser.id, autoUser.id])
  const otherManualSnapshot = await snapshotOtherManualPending(admin, testUserIds)
  report.details.otherManualPendingCount = otherManualSnapshot.length

  for (const uid of testUserIds) {
    await admin.from('instagram_follow_bonus').delete().eq('user_id', uid)
    await admin.from('orders').delete().eq('user_id', uid)
    const { error: termsError } = await admin.from('terms_agreements').upsert(
      { user_id: uid, version: 'v1', agreed_at: new Date().toISOString() },
      { onConflict: 'user_id,version' }
    )
    if (termsError) {
      const inserted = await admin.from('terms_agreements').insert({
        user_id: uid,
        version: 'v1',
        agreed_at: new Date().toISOString(),
      })
      if (inserted.error && !String(inserted.error.message).includes('duplicate')) {
        throw new Error(`terms insert failed: ${inserted.error.message}`)
      }
    }
    const { data: termsRow, error: termsCheckError } = await admin
      .from('terms_agreements')
      .select('id')
      .eq('user_id', uid)
      .eq('version', 'v1')
      .maybeSingle()
    if (termsCheckError || !termsRow) {
      throw new Error(`terms not saved for ${uid}: ${termsCheckError?.message ?? 'missing row'}`)
    }
  }

  const stamp = Date.now().toString(36).slice(-6)
  const handleManual = `igmanual${stamp}`
  const handleAuto = `igauto${stamp}`
  const handleApproved = `igappr${stamp}`
  const nowIso = new Date().toISOString()
  const fakeHandles = []

  await admin.from('instagram_follow_bonus').insert({
    user_id: manualUser.id,
    instagram_handle: handleManual,
    status: 'pending',
    updated_at: nowIso,
  })
  await admin.from('instagram_follow_bonus').insert({
    user_id: approvedUser.id,
    instagram_handle: handleApproved,
    status: 'approved',
    approved_at: nowIso,
    bonus_days_granted: 14,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    updated_at: nowIso,
  })
  await admin.from('instagram_follow_bonus').insert({
    user_id: autoUser.id,
    instagram_handle: handleAuto,
    status: 'pending',
    updated_at: nowIso,
  })

  const playwright = await ensurePlaywright()
  const browser = await playwright.chromium.launch({ headless: true })
  const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    const sessionBefore = await signIn(env, USERS.manual.email, USERS.manual.password)
    const beforeContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ['geolocation'],
    })
    await beforeContext.addCookies(toPlaywrightCookies(sessionBefore.jar))
    await beforeContext.addInitScript(onboardingInitScript(), { uid: manualUser.id })
    const beforePage = await beforeContext.newPage()
    const gpsBefore = await inspectGpsOnEvents(beforePage, gpsEvent.name)
    report.screenshots.push(await shot(beforePage, 'b0-events-gps-before-unlock'))
    await beforePage.goto(`${BASE}/events/${albumEvent.id}`, {
      waitUntil: 'networkidle',
      timeout: 90_000,
    })
    await completeTermsIfNeeded(beforePage)
    await dismissBlockingModals(beforePage)
    report.screenshots.push(await shot(beforePage, 'b0-album-locked-before-unlock'))
    const albumBeforeText = await beforePage.locator('body').innerText()
    report.details.albumBeforeLocked = albumBeforeText.includes('인증 없이는')
    await beforeContext.close()

    const players = await listPlayers(adminToken)
    const pendingRow = players.find(p => p.id === manualUser.id)
    const uiA = await screenshotPlayersRow(
      adminPage,
      adminToken,
      USERS.manual.email,
      'a-pending-button.png'
    )
    report.details.a_ui = uiA
    report.details.a_player = pendingRow
    report.screenshots.push(...uiA.screenshots)
    report.checks.a_pending_button_visible = {
      pass: pendingRow?.instagram_can_manual_approve === true && uiA.hasInstantApproveButton === true,
      can_manual_approve: pendingRow?.instagram_can_manual_approve,
      hasButton: uiA.hasInstantApproveButton,
    }

    await loginAdmin(adminPage, adminToken)
    await openPlayersTab(adminPage)
    const approveRow = adminPage.locator('table tbody tr', { hasText: USERS.manual.email })
    await approveRow.waitFor({ timeout: 60_000 })
    await approveRow.scrollIntoViewIfNeeded()
    await approveRow.getByRole('button', { name: '즉시 승인' }).click()
    await adminPage.waitForTimeout(2500)

    const { data: afterManualRow } = await admin
      .from('instagram_follow_bonus')
      .select('*')
      .eq('user_id', manualUser.id)
      .single()

    const sessionAfter = await signIn(env, USERS.manual.email, USERS.manual.password)
    const statusRes = await fetch(`${BASE}/api/verify-order/status?event_id=${albumEvent.id}`, {
      headers: { Authorization: `Bearer ${sessionAfter.accessToken}` },
    })
    const statusData = await statusRes.json()
    report.details.statusAfterManual = { http: statusRes.status, statusData }
    const gpsStatusRes = await fetch(`${BASE}/api/verify-order/status`, {
      headers: { Authorization: `Bearer ${sessionAfter.accessToken}` },
    })
    const gpsStatusData = await gpsStatusRes.json()
    const mypageRes = await fetch(`${BASE}/api/mypage`, {
      headers: { Authorization: `Bearer ${sessionAfter.accessToken}` },
    })
    const mypageData = await mypageRes.json()

    const afterContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      geolocation: { latitude: 37.5665, longitude: 126.978 },
      permissions: ['geolocation'],
    })
    await afterContext.addCookies(toPlaywrightCookies(sessionAfter.jar))
    await afterContext.addInitScript(onboardingInitScript(), { uid: manualUser.id })
    const eventPage = await afterContext.newPage()
    const gpsAfter = await inspectGpsOnEvents(eventPage, gpsEvent.name)
    report.screenshots.push(await shot(eventPage, 'b-events-gps-after-unlock'))

    if (gpsAfter.found && !gpsAfter.gpsDisabled) {
      const item = eventPage.locator('.event-upcoming-item').filter({ hasText: gpsEvent.name }).first()
      await item.getByRole('switch').click()
      await dismissBlockingModals(eventPage)
      await eventPage.waitForTimeout(800)
      report.screenshots.push(await shot(eventPage, 'b-events-gps-toggled-on'))
    }

    await eventPage.goto(`${BASE}/events/${albumEvent.id}`, {
      waitUntil: 'networkidle',
      timeout: 90_000,
    })
    await completeTermsIfNeeded(eventPage)
    await dismissBlockingModals(eventPage)
    const albumAfterText = await eventPage.locator('body').innerText()
    const albumUnlocked =
      (await eventPage.getByRole('button', { name: '앨범 열기' }).count()) > 0
    const albumStillLocked = albumAfterText.includes('인증 없이는')
    report.screenshots.push(await shot(eventPage, 'b-album-unlocked-after-approve'))

    const mypagePage = await afterContext.newPage()
    await mypagePage.goto(`${BASE}/mypage`, { waitUntil: 'networkidle', timeout: 90_000 })
    await completeTermsIfNeeded(mypagePage)
    await dismissBlockingModals(mypagePage)
    const mypageText = await mypagePage.locator('body').innerText()
    report.screenshots.push(await shot(mypagePage, 'b-mypage-benefit'))
    await afterContext.close()

    const uiB = await screenshotPlayersRow(
      adminPage,
      adminToken,
      USERS.manual.email,
      'b-after-manual-unlock-players.png'
    )
    report.details.b_ui = uiB
    report.screenshots.push(...uiB.screenshots)

    const igBonus = mypageData?.instagram_follow_bonus
    report.checks.b_manual_unlock_effects = {
      pass:
        afterManualRow?.status === 'pending' &&
        afterManualRow?.manually_unlocked === true &&
        !!afterManualRow?.expires_at &&
        statusData.instagram_follow_verified === true &&
        gpsStatusData.gps_tracking_eligible === true &&
        gpsBefore.gpsDisabled === true &&
        gpsAfter.gpsDisabled === false &&
        !albumStillLocked &&
        albumUnlocked &&
        igBonus?.state === 'active' &&
        mypageText.includes('무료 열람 기간'),
      afterManualRow: {
        status: afterManualRow?.status,
        manually_unlocked: afterManualRow?.manually_unlocked,
        expires_at: afterManualRow?.expires_at,
      },
      statusData: {
        instagram_follow_verified: statusData.instagram_follow_verified,
        gps_tracking_eligible: statusData.gps_tracking_eligible,
        access_source: statusData.access_source,
      },
      gpsStatusEligible: gpsStatusData.gps_tracking_eligible,
      gpsBefore,
      gpsAfter,
      albumUnlocked,
      albumStillLocked,
      mypageState: igBonus?.state,
      mypagePeriod: igBonus?.period_label,
    }

    const approvedPlayers = await listPlayers(adminToken)
    const approvedRow = approvedPlayers.find(p => p.id === approvedUser.id)
    const uiC = await screenshotPlayersRow(
      adminPage,
      adminToken,
      USERS.approved.email,
      'c-approved-no-button.png'
    )
    report.checks.c_approved_no_button = {
      pass: approvedRow?.instagram_can_manual_approve === false && uiC.hasInstantApproveButton === false,
      can_manual_approve: approvedRow?.instagram_can_manual_approve,
      ui: uiC,
    }
    report.screenshots.push(...uiC.screenshots)

    fakeHandles.push(handleManual)
    const matchD = await uploadFollowersHtml(adminToken, [handleManual])
    await restoreOtherManualPending(admin, otherManualSnapshot)
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
      afterMatchRow: {
        status: afterMatchRow?.status,
        manually_unlocked: afterMatchRow?.manually_unlocked,
        mismatch: afterMatchRow?.manual_unlock_verified_mismatch,
      },
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

    const handleMismatch = `igmis${stamp}`
    await admin.from('instagram_follow_bonus').delete().eq('user_id', manualUser.id)
    await admin.from('instagram_follow_bonus').insert({
      user_id: manualUser.id,
      instagram_handle: handleMismatch,
      status: 'pending',
      updated_at: nowIso,
    })
    await adminFetch(adminToken, '/api/admin/players/instagram-manual-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: manualUser.id }),
    })
    fakeHandles.push('someoneelseonly')
    const mismatchUpload = await uploadFollowersHtml(adminToken, ['someoneelseonly'])
    await restoreOtherManualPending(admin, otherManualSnapshot)
    const { data: mismatchRow } = await admin
      .from('instagram_follow_bonus')
      .select('*')
      .eq('user_id', manualUser.id)
      .single()
    const mismatchPlayers = await listPlayers(adminToken)
    const mismatchPlayer = mismatchPlayers.find(p => p.id === manualUser.id)
    const uiE = await screenshotPlayersRow(
      adminPage,
      adminToken,
      USERS.manual.email,
      'e-mismatch-warning.png'
    )
    report.checks.e_manual_omitted_mismatch = {
      pass:
        mismatchRow?.status === 'pending' &&
        mismatchRow?.manually_unlocked === true &&
        mismatchRow?.manual_unlock_verified_mismatch === true &&
        (mismatchUpload.data?.manual_unlock_mismatches ?? 0) >= 1 &&
        mismatchPlayer?.instagram_manual_unlock_mismatch === true &&
        uiE.hasMismatch === true,
      mismatchRow: {
        status: mismatchRow?.status,
        manually_unlocked: mismatchRow?.manually_unlocked,
        mismatch: mismatchRow?.manual_unlock_verified_mismatch,
      },
      upload: mismatchUpload.data,
      ui: uiE,
    }
    report.screenshots.push(...uiE.screenshots)

    await admin.from('instagram_follow_bonus').delete().eq('user_id', autoUser.id)
    await admin.from('instagram_follow_bonus').insert({
      user_id: autoUser.id,
      instagram_handle: handleAuto,
      status: 'pending',
      updated_at: nowIso,
    })
    fakeHandles.push(handleAuto)
    const matchF = await uploadFollowersHtml(adminToken, [handleAuto])
    await restoreOtherManualPending(admin, otherManualSnapshot)
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
      pass: matchF.res.ok && autoRow?.status === 'approved' && (matchF.data?.matched_approved ?? 0) >= 1,
      upload: matchF.data,
      autoRow: { status: autoRow?.status, handle: autoRow?.instagram_handle },
      ui: uiF,
    }
    report.screenshots.push(...uiF.screenshots)
  } finally {
    await restoreOtherManualPending(admin, otherManualSnapshot)
    if (fakeHandles.length) {
      await admin.from('instagram_followers').delete().in('username', fakeHandles)
    }
    await browser.close()
  }

  const allPass = Object.values(report.checks).every(v => v.pass === true)
  report.allPass = allPass
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!allPass) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
