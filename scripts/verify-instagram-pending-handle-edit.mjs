/**
 * pending 인스타 아이디 수정 검증
 * node scripts/verify-instagram-pending-handle-edit.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.VERIFY_BASE_URL ?? 'http://localhost:3000'
const outDir = path.join(root, '.tmp-checklist', 'verify-pending-handle-edit')

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

async function signInWithCookieJar(env, email, password) {
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

function toLocalCookies(jar) {
  return jar.map(c => ({
    name: c.name,
    value: c.value,
    domain: 'localhost',
    path: c.path ?? '/',
    secure: false,
    sameSite: 'Lax',
    httpOnly: c.httpOnly ?? false,
  }))
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const stamp = Date.now().toString(36).slice(-6)
const password = 'PwPendingEdit2026!'
const email = `ig-edit-${stamp}@okbro.internal`
const approvedEmail = `ig-edit-appr-${stamp}@okbro.internal`
const handle1 = `igedit1_${stamp}`
const handle2 = `igedit2_${stamp}`
const handle3 = `igedit3_${stamp}`
const approvedHandle = `igeditok_${stamp}`

const createdIds = []

async function createUser(emailAddr, name) {
  const { data, error } = await admin.auth.admin.createUser({
    email: emailAddr,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error) throw error
  createdIds.push(data.user.id)
  const { error: termsError } = await admin.from('terms_agreements').insert({
    user_id: data.user.id,
    version: 'v1',
    agreed_at: new Date().toISOString(),
  })
  if (termsError) throw new Error(`terms insert failed: ${termsError.message}`)
  return data.user
}

try {
  const pendingUser = await createUser(email, '아이디수정검증')
  const approvedUser = await createUser(approvedEmail, '승인수정불가')

  const pendingAuth = await signInWithCookieJar(env, email, password)
  const approvedAuth = await signInWithCookieJar(env, approvedEmail, password)

  async function claim(accessToken, handle) {
    const res = await fetch(`${BASE}/api/instagram-follow/claim`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ instagram_handle: handle }),
    })
    return { res, data: await res.json() }
  }

  const first = await claim(pendingAuth.accessToken, handle1)
  const { data: afterFirst } = await admin
    .from('instagram_follow_bonus')
    .select('id, instagram_handle, status')
    .eq('user_id', pendingUser.id)

  await admin
    .from('instagram_follow_bonus')
    .update({
      manually_unlocked: true,
      manual_unlock_verified_mismatch: true,
      approved_at: new Date().toISOString(),
      bonus_days_granted: 5,
      expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    })
    .eq('user_id', pendingUser.id)
    .eq('status', 'pending')

  const second = await claim(pendingAuth.accessToken, handle2)
  const { data: afterSecond } = await admin
    .from('instagram_follow_bonus')
    .select(
      'id, instagram_handle, status, manually_unlocked, manual_unlock_verified_mismatch, approved_at, expires_at'
    )
    .eq('user_id', pendingUser.id)

  const playersRes = await fetch(`${BASE}/api/admin/players`, {
    headers: { 'x-admin-token': env.ADMIN_PASSWORD },
  })
  const playersData = await playersRes.json()
  const player = (playersData.players ?? []).find(p => p.id === pendingUser.id)

  await admin.from('instagram_follow_bonus').insert({
    user_id: approvedUser.id,
    instagram_handle: approvedHandle,
    status: 'approved',
    approved_at: new Date().toISOString(),
    bonus_days_granted: 5,
    expires_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  })

  const approvedStatusRes = await fetch(`${BASE}/api/instagram-follow/status`, {
    headers: { authorization: `Bearer ${approvedAuth.accessToken}` },
  })
  const approvedStatus = await approvedStatusRes.json()

  fs.mkdirSync(outDir, { recursive: true })
  const playwright = await ensurePlaywright()
  const browser = await playwright.chromium.launch({ headless: true })

  async function openMypage(jar, uid) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addCookies(toLocalCookies(jar))
    await context.addInitScript(userId => {
      localStorage.setItem('terms_agreed_v1', 'true')
      localStorage.setItem('okbro_app_first_launch_done', '1')
      localStorage.setItem('okbro_permission_notification_asked', '1')
      localStorage.setItem('okbro_onboarding_verification_skipped', '1')
      if (userId) localStorage.setItem(`okbro_instagram_follow_onboarding_done_${userId}`, '1')
    }, uid)
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', err => consoleErrors.push(String(err)))
    await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle', timeout: 90_000 })
    await page.waitForTimeout(1200)
    return { context, page, consoleErrors }
  }

  const pendingUi = await openMypage(pendingAuth.jar, pendingUser.id)
  const pendingText = await pendingUi.page.locator('text=제출한 아이디').count()
  const editBtn = pendingUi.page.getByRole('button', { name: '수정하기' })
  const hasEdit = (await editBtn.count()) > 0
  let successAfterEdit = 0
  if (hasEdit) {
    await editBtn.click()
    await pendingUi.page.fill('#mypage-instagram-handle-edit', handle3)
    await pendingUi.page.getByRole('button', { name: '다시 제출하기' }).click()
    try {
      await pendingUi.page.locator('text=제출 완료').waitFor({ state: 'visible', timeout: 30_000 })
      successAfterEdit = 1
    } catch {
      successAfterEdit = await pendingUi.page.locator('text=제출 완료').count()
    }
  }
  await pendingUi.page.screenshot({
    path: path.join(outDir, '01-mypage-pending-edit.png'),
    fullPage: true,
  })
  await pendingUi.context.close()

  const { data: afterUi } = await admin
    .from('instagram_follow_bonus')
    .select('id, instagram_handle, status, manually_unlocked, manual_unlock_verified_mismatch')
    .eq('user_id', pendingUser.id)

  const approvedUi = await openMypage(approvedAuth.jar, approvedUser.id)
  const approvedHasEdit = (await approvedUi.page.getByRole('button', { name: '수정하기' }).count()) > 0
  await approvedUi.page.screenshot({
    path: path.join(outDir, '02-mypage-approved-no-edit.png'),
    fullPage: true,
  })
  await approvedUi.context.close()
  await browser.close()

  const report = {
    firstOk: first.res.ok && first.data.success === true,
    firstMessage: first.data.message,
    afterFirstCount: afterFirst?.length ?? 0,
    afterFirstHandle: afterFirst?.[0]?.instagram_handle ?? null,
    secondOk: second.res.ok && second.data.success === true && second.data.updated === true,
    secondMessage: second.data.message,
    afterSecondCount: afterSecond?.length ?? 0,
    afterSecond: afterSecond?.[0]
      ? {
          handle: afterSecond[0].instagram_handle,
          status: afterSecond[0].status,
          manually_unlocked: afterSecond[0].manually_unlocked,
          mismatch: afterSecond[0].manual_unlock_verified_mismatch,
          approved_at: afterSecond[0].approved_at,
          expires_at: afterSecond[0].expires_at,
        }
      : null,
    playersHandle: player?.instagram_handle ?? null,
    approvedStatus: approvedStatus?.state ?? null,
    ui: {
      pendingTextVisible: pendingText > 0,
      hasEdit,
      successAfterEdit: successAfterEdit > 0,
      approvedHasEdit,
      afterUiHandle: afterUi?.[0]?.instagram_handle ?? null,
      afterUiCount: afterUi?.length ?? 0,
      pendingConsoleErrors: pendingUi.consoleErrors,
      approvedConsoleErrors: approvedUi.consoleErrors,
    },
    pass: false,
  }

  report.pass =
    report.firstOk &&
    report.afterFirstCount === 1 &&
    report.afterFirstHandle === handle1 &&
    report.secondOk &&
    report.afterSecondCount === 1 &&
    report.afterSecond?.handle === handle2 &&
    report.afterSecond?.status === 'pending' &&
    report.afterSecond?.manually_unlocked === false &&
    report.afterSecond?.mismatch === false &&
    report.afterSecond?.approved_at == null &&
    report.playersHandle === handle2 &&
    report.approvedStatus === 'active' &&
    report.ui.pendingTextVisible &&
    report.ui.hasEdit &&
    report.ui.successAfterEdit &&
    report.ui.approvedHasEdit === false &&
    report.ui.afterUiCount === 1 &&
    report.ui.afterUiHandle === handle3 &&
    report.ui.pendingConsoleErrors.length === 0 &&
    report.ui.approvedConsoleErrors.length === 0

  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exit(1)
} finally {
  for (const id of createdIds) {
    await admin.from('instagram_follow_bonus').delete().eq('user_id', id)
    await admin.from('terms_agreements').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
}
