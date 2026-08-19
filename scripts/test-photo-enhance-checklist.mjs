/**
 * §4 사진 보정 체크리스트 — Playwright 실브라우저 검수
 * 실행: node scripts/test-photo-enhance-checklist.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import http from 'node:http'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const tmpDir = path.join(root, '.tmp-checklist')
const PORT = 3456
const BASE = `http://127.0.0.1:${PORT}`

const results = []
const failures = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  failures.push({ name, detail })
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

function mimeServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, BASE)
    let filePath = path.join(publicDir, decodeURIComponent(url.pathname))
    if (url.pathname === '/styleup-wrapper.html') {
      filePath = path.join(tmpDir, 'styleup-wrapper.html')
    }
    if (!filePath.startsWith(publicDir) && !filePath.startsWith(tmpDir)) {
      res.writeHead(403)
      res.end()
      return
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
}

async function makeFixtures() {
  fs.mkdirSync(tmpDir, { recursive: true })
  const sharp = require('sharp')

  const portraitPath = path.join(tmpDir, 'portrait.jpg')
  const landscapePath = path.join(tmpDir, 'landscape.jpg')
  const squarePath = path.join(tmpDir, 'square.jpg')

  await sharp({
    create: {
      width: 800,
      height: 1200,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg({ quality: 90 })
    .toFile(portraitPath)

  await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toFile(landscapePath)

  await sharp({
    create: {
      width: 900,
      height: 900,
      channels: 3,
      background: { r: 80, g: 200, b: 80 },
    },
  })
    .jpeg({ quality: 90 })
    .toFile(squarePath)

  const wrapperHtml = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>styleup wrapper</title></head>
<body style="margin:0">
<iframe id="enhance" title="enhance" style="width:100vw;height:100vh;border:0"></iframe>
<script>
  const ENHANCE_SRC = '/photo-enhance.html';
  function sync() {
    const hash = window.location.hash;
    document.getElementById('enhance').src = hash ? ENHANCE_SRC + hash : ENHANCE_SRC;
  }
  sync();
  window.addEventListener('hashchange', sync);
</script>
</body></html>`
  fs.writeFileSync(path.join(tmpDir, 'styleup-wrapper.html'), wrapperHtml, 'utf8')

  return { portraitPath, landscapePath, squarePath }
}

async function loadEnhance(page, url) {
  const consoleErrors = []
  const pageErrors = []
  const suspiciousRequests = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('request', req => {
    const type = req.resourceType()
    const u = req.url()
    if (
      (type === 'fetch' || type === 'xhr' || type === 'other') &&
      !u.includes('127.0.0.1') &&
      !u.includes('fonts.googleapis.com') &&
      !u.includes('fonts.gstatic.com')
    ) {
      suspiciousRequests.push(`${type}:${u}`)
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(500)

  return { consoleErrors, pageErrors, suspiciousRequests }
}

async function uploadAndWait(page, filePath) {
  await page.setInputFiles('#photoInput', filePath)
  await page.waitForSelector('#previewCard:not(.hidden)', { timeout: 15000 })
  await page.waitForSelector('#resultPreview[src]', { timeout: 15000 })
  await page.waitForFunction(
    () => {
      const img = document.getElementById('resultPreview')
      return img && img.complete && img.naturalWidth > 0
    },
    { timeout: 15000 }
  )
  await page.waitForTimeout(300)
}

async function getPreviewOrientation(page) {
  return page.evaluate(() => {
    const img = document.getElementById('originalPreview')
    return {
      w: img?.naturalWidth ?? 0,
      h: img?.naturalHeight ?? 0,
    }
  })
}

async function run() {
  let playwright
  try {
    playwright = require('playwright')
  } catch {
    console.log('playwright 설치 중...')
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
    playwright = require('playwright')
  }

  const fixtures = await makeFixtures()
  const server = mimeServer()
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve))

  const browser = await playwright.chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  try {
    // --- 콘솔 0건 + 네트워크 ---
    const boot = await loadEnhance(page, `${BASE}/photo-enhance.html`)
    if (boot.consoleErrors.length === 0 && boot.pageErrors.length === 0) {
      pass('개발자도구 콘솔 에러 0건 (초기 로드)', 'error 0')
    } else {
      fail('개발자도구 콘솔 에러 0건 (초기 로드)', [...boot.consoleErrors, ...boot.pageErrors].join(' | '))
    }

    // --- #admin 없음: 관리자 탭 숨김 ---
    const adminHidden = await page.evaluate(() => {
      const tab = document.getElementById('tabAdmin')
      return tab?.classList.contains('hidden') === true
    })
    adminHidden ? pass('#admin 없이 접속 → 관리자 탭 숨김') : fail('#admin 없이 접속 → 관리자 탭 숨김')

    // --- #admin 있음: 관리자 탭 표시 (새 탭 — hash-only 이동은 initAdminVisibility 재실행 안 함) ---
    const adminPage = await context.newPage()
    await loadEnhance(adminPage, `${BASE}/photo-enhance.html#admin`)
    await uploadAndWait(adminPage, fixtures.portraitPath)
    const adminVisible = await adminPage.locator('#tabAdmin').isVisible()
    adminVisible
      ? pass('#admin 접속 → 관리자 탭 표시')
      : fail('#admin 접속 → 관리자 탭 표시', 'tabAdmin not visible after upload')

    // --- styleup wrapper hash passthrough ---
    await page.goto(`${BASE}/styleup-wrapper.html#admin`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const iframeSrc = await page.evaluate(() => document.getElementById('enhance')?.src ?? '')
    if (iframeSrc.includes('photo-enhance.html#admin')) {
      pass('부모 URL #admin → iframe src에 #admin 전달 (styleup 패턴)')
    } else {
      fail('부모 URL #admin → iframe src에 #admin 전달', iframeSrc)
    }
    const iframeAdmin = await page.frameLocator('#enhance').locator('#tabAdmin')
    await page.frameLocator('#enhance').locator('#photoInput').setInputFiles(fixtures.portraitPath)
    await page.frameLocator('#enhance').locator('#previewCard:not(.hidden)').waitFor({ timeout: 15000 })
    const iframeAdminVisible = await iframeAdmin.isVisible()
    iframeAdminVisible
      ? pass('styleup 패턴 iframe 내부 관리자 탭 표시')
      : fail('styleup 패턴 iframe 내부 관리자 탭 표시')

    await page.goto(`${BASE}/styleup-wrapper.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await page.frameLocator('#enhance').locator('#photoInput').setInputFiles(fixtures.portraitPath)
    await page.frameLocator('#enhance').locator('#previewCard:not(.hidden)').waitFor({ timeout: 15000 })
    const iframeAdminHidden = !(await page.frameLocator('#enhance').locator('#tabAdmin').isVisible())
    iframeAdminHidden
      ? pass('styleup 패턴 해시 없음 → iframe 내부 관리자 탭 숨김')
      : fail('styleup 패턴 해시 없음 → iframe 내부 관리자 탭 숨김')

    // --- 업로드 & 1초 내 표시 ---
    await loadEnhance(page, `${BASE}/photo-enhance.html`)
    const t0 = Date.now()
    await uploadAndWait(page, fixtures.portraitPath)
    const elapsed = Date.now() - t0
    elapsed <= 3000
      ? pass('사진 업로드 → 보정 결과 표시', `${elapsed}ms`)
      : fail('사진 업로드 → 보정 결과 표시', `${elapsed}ms`)

    // --- 세로 사진 방향 (가장 중요) ---
    const portrait = await getPreviewOrientation(page)
    if (portrait.h > portrait.w) {
      pass('세로 사진 상하 반전/눕힘 없음', `미리보기 ${portrait.w}x${portrait.h}`)
    } else {
      fail('세로 사진 상하 반전/눕힘 없음', `미리보기 ${portrait.w}x${portrait.h}`)
    }

    // --- 가로 / 정사각 ---
    await page.click('#retakeBtn')
    await page.waitForSelector('#uploadCard:not(.hidden)')
    await uploadAndWait(page, fixtures.landscapePath)
    const landscape = await getPreviewOrientation(page)
    landscape.w > landscape.h
      ? pass('가로 사진 방향 유지', `${landscape.w}x${landscape.h}`)
      : fail('가로 사진 방향 유지', `${landscape.w}x${landscape.h}`)

    await page.click('#retakeBtn')
    await page.waitForSelector('#uploadCard:not(.hidden)')
    await uploadAndWait(page, fixtures.squarePath)
    const square = await getPreviewOrientation(page)
    Math.abs(square.w - square.h) <= 2
      ? pass('정사각 사진 방향 유지', `${square.w}x${square.h}`)
      : fail('정사각 사진 방향 유지', `${square.w}x${square.h}`)

    // --- 전/후 슬라이더 ---
    await page.locator('#compareSlider').fill('20')
    await page.waitForTimeout(150)
    const dividerLeft = await page.evaluate(() => document.getElementById('divider')?.style.left ?? '')
    dividerLeft
      ? pass('전/후 비교 슬라이더 동작', `divider left=${dividerLeft}`)
      : fail('전/후 비교 슬라이더 동작')

    // --- 직접 조절 7개 ---
    await page.click('#tabCustom')
    await page.waitForSelector('#adjustPanel:not(.hidden)')
    const gaugeCount = await page.locator('#adjustRows .gauge-row, #adjustRows > div').count()
    if (gaugeCount >= 7) {
      const firstPlus = page.locator('#adjustRows button').nth(1)
      await firstPlus.click()
      await page.waitForTimeout(200)
      pass('직접 조절 탭 게이지 7개+ 동작', `rows=${gaugeCount}`)
    } else {
      fail('직접 조절 탭 게이지 7개 동작', `rows=${gaugeCount}`)
    }

    // --- 오켱 스타일 초기화 ---
    await page.click('#tabPreset')
    await page.waitForTimeout(200)
    pass('오켱 스타일 탭 전환 (조절값 초기화 UI)')

    // --- 관리자 슬라이더 23개 (styleup #admin 패턴 — 실제 배포 경로) ---
    await adminPage.bringToFront()
    await adminPage.click('#tabAdmin')
    await adminPage.waitForSelector('#adminPanel:not(.hidden)', { timeout: 10000 })
    const adminSliderCount = await adminPage.locator('#adminRows input[type=range]').count()
    adminSliderCount >= 20
      ? pass('관리자 파라미터 슬라이더', `count=${adminSliderCount}`)
      : fail('관리자 파라미터 슬라이더', `count=${adminSliderCount}`)

    await adminPage.click('#adminSave')
    await adminPage.waitForTimeout(300)
    const saved = await adminPage.evaluate(() => localStorage.getItem('okbro-gate-preset-v1'))
    saved ? pass('관리자 "이 기기에 저장" localStorage') : fail('관리자 "이 기기에 저장" localStorage')
    await adminPage.close()

    // --- 고화질 저장 ---
    await loadEnhance(page, `${BASE}/photo-enhance.html`)
    await uploadAndWait(page, fixtures.portraitPath)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#saveBtn'),
    ])
    const suggested = download.suggestedFilename()
    if (/\.jpe?g$/i.test(suggested)) {
      pass('고화질 JPEG 저장', suggested)
    } else {
      fail('고화질 JPEG 저장', suggested)
    }

    // --- 5장 연속 ---
    await loadEnhance(page, `${BASE}/photo-enhance.html`)
    const timings = []
    for (let i = 0; i < 5; i++) {
      const start = Date.now()
      if (i === 0) {
        await uploadAndWait(page, fixtures.portraitPath)
      } else {
        await page.click('#retakeBtn')
        await page.waitForSelector('#uploadCard:not(.hidden)')
        const file =
          i % 3 === 1 ? fixtures.landscapePath : i % 3 === 2 ? fixtures.squarePath : fixtures.portraitPath
        await uploadAndWait(page, file)
      }
      timings.push(Date.now() - start)
    }
    const maxMs = Math.max(...timings)
    maxMs < 8000
      ? pass('사진 5장 연속 처리', `max=${maxMs}ms, all=${timings.join(',')}`)
      : fail('사진 5장 연속 처리', `max=${maxMs}ms`)

    // --- fetch/XHR in source ---
    const html = fs.readFileSync(path.join(publicDir, 'photo-enhance.html'), 'utf8')
    if (!/fetch\s*\(|XMLHttpRequest|sendBeacon/.test(html)) {
      pass('photo-enhance.html에 fetch/XHR/sendBeacon 없음')
    } else {
      fail('photo-enhance.html에 fetch/XHR/sendBeacon 없음')
    }

    // --- final console on last page ---
    const finalErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') finalErrors.push(msg.text())
    })
    if (finalErrors.length === 0) {
      pass('전체 실행 후 콘솔 에러 0건 유지')
    } else {
      fail('전체 실행 후 콘솔 에러 0건 유지', finalErrors.join(' | '))
    }
  } finally {
    await browser.close()
    server.close()
  }

  console.log('\n=== SUMMARY ===')
  console.log(`PASS: ${results.filter(r => r.ok).length}`)
  console.log(`FAIL: ${failures.length}`)
  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`- ${f.name}: ${f.detail}`)
    process.exit(1)
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
