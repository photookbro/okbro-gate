import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

/** Prefer OneDrive「오켱게이트」원본 when present; else local diagnosis-source.html */
function resolveSourcePath() {
  const local = path.join(root, 'diagnosis-source.html')
  const oneDrive = process.env.ONEDRIVE || path.join(process.env.USERPROFILE || '', 'OneDrive')
  try {
    for (const dir of fs.readdirSync(oneDrive, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      // Folder name includes GATE in Korean; match by recent diagnosis-like html size
      const dirPath = path.join(oneDrive, dir.name)
      let files = []
      try {
        files = fs.readdirSync(dirPath)
      } catch {
        continue
      }
      const hit = files.find(
        f =>
          f.endsWith('.html') &&
          (f.includes('영양') || f.includes('진단') || f.includes('성분'))
      )
      if (hit) {
        const full = path.join(dirPath, hit)
        const st = fs.statSync(full)
        if (st.size > 30_000) {
          console.log('source (OneDrive):', full)
          return full
        }
      }
    }
  } catch (e) {
    console.warn('OneDrive lookup skipped:', e.message)
  }
  console.log('source (local):', local)
  return local
}

let html = fs.readFileSync(resolveSourcePath(), 'utf8')

html = html.replace(
  /:root\{[\s\S]*?\n  \}/,
  `:root{
    --coral:#FF2800;
    --coral-deep:#CC2000;
    --coral-soft:rgba(255,40,0,0.18);
    --ink:#FFFFFF;
    --ink-soft:#A8A8A8;
    --line:#2A2A2A;
    --card:#161616;
    --bg:#0d0d0d;
    --bg-tint:#1a1a1a;
    --amber:#FFB400;
    --amber-soft:rgba(255,180,0,0.16);
    --teal:#00C2B2;
    --teal-soft:rgba(0,166,153,0.18);
    --radius-l:24px;
    --radius-m:16px;
    --radius-s:10px;
    --sans: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Segoe UI', Roboto, sans-serif;
  }`
)

html = html.replace(
  'background:rgba(255,255,255,.92);',
  'background:rgba(13,13,13,.92);'
)
html = html.replaceAll('background:#fff;', 'background:var(--bg-tint);')
html = html.replace(
  'box-shadow:0 6px 18px rgba(255,56,92,.28);',
  'box-shadow:0 6px 18px rgba(255,40,0,.28);'
)
html = html.replaceAll(
  'background:linear-gradient(135deg,var(--coral),#FF7A8A)',
  'background:linear-gradient(135deg,var(--coral),#FF5533)'
)
html = html.replace(
  'box-shadow:0 4px 18px rgba(0,0,0,.06);',
  'box-shadow:0 4px 18px rgba(0,0,0,.35);'
)

html = html.replace(
  '.hero .eyebrow{display:inline-flex;align-items:center;gap:6px;background:var(--coral-soft);color:var(--coral-deep);',
  '.hero .eyebrow{display:inline-flex;align-items:center;gap:6px;background:var(--coral-soft);color:#FF6A45;'
)
html = html.replace(
  '.profile-card .ptitle .badge{width:32px;height:32px;border-radius:50%;background:var(--coral-soft);color:var(--coral-deep);',
  '.profile-card .ptitle .badge{width:32px;height:32px;border-radius:50%;background:var(--coral-soft);color:#FF6A45;'
)
html = html.replace(
  '.section-head .badge{width:36px;height:36px;border-radius:50%;background:var(--coral-soft);color:var(--coral-deep);',
  '.section-head .badge{width:36px;height:36px;border-radius:50%;background:var(--coral-soft);color:#FF6A45;'
)

const nameFieldRe =
  /\s*<div class="field full">\s*<label>이름 또는 닉네임[\s\S]*?<\/div>\s*(?=<div class="field">\s*<label>나이)/
html = html.replace(nameFieldRe, '\n      ')

html = html.replace(
  /const name = document\.getElementById\('pName'\)\.value\.trim\(\) \|\| '고객';\r?\n\s*/,
  ''
)
html = html.replace(
  "<h3>${name}님, ${new Date().toLocaleDateString('ko-KR')} 기준 리포트예요</h3>",
  "<h3>${new Date().toLocaleDateString('ko-KR')} 기준 자가진단 리포트예요</h3>"
)

const out = path.join(root, 'public', 'diagnosis-app.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, html, 'utf8')
console.log('written', out, fs.statSync(out).size)
console.log({
  pName: html.includes('pName'),
  nameLabel: html.includes('이름 또는'),
  report: html.includes('자가진단 리포트'),
  brand: html.includes('#FF2800'),
})
