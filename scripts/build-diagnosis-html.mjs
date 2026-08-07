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

html = html.replace(
  '입력한 정보는 저장되지 않고 이 화면에서만 계산에 사용돼요.',
  '결과는 이 기기에만 저장되며 서버로는 전송되지 않아요.'
)
html = html.replace(
  '입력하신 개인 정보는 서버에 저장되지 않고 이 화면에서만 계산에 사용돼요.',
  '결과는 이 기기의 브라우저에만 저장되며 서버로는 전송되지 않아요.'
)

/** Persist answers/results in localStorage + allow re-submit after edits */
if (!html.includes('okbro-gate-check-v1')) {
  html = html.replace(
    'const answers = {};',
    `const STORAGE_KEY = 'okbro-gate-check-v1';
let hasShownResults = false;
const answers = {};

function saveState(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      answers,
      profile,
      age: document.getElementById('pAge').value,
      height: document.getElementById('pHeight').value,
      weight: document.getElementById('pWeight').value,
      meds: document.getElementById('pMeds').value,
      shown: hasShownResults,
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

function restoreState(){
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { return; }
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch (_) { return; }
  if (!data || data.v !== 1) return;

  if (data.age != null) document.getElementById('pAge').value = data.age;
  if (data.height != null) document.getElementById('pHeight').value = data.height;
  if (data.weight != null) document.getElementById('pWeight').value = data.weight;
  if (data.meds != null) document.getElementById('pMeds').value = data.meds;

  if (data.profile && data.profile.gender) {
    profile.gender = data.profile.gender;
    document.querySelectorAll('#pGender .pill').forEach(p => {
      p.classList.toggle('checked', p.dataset.v === profile.gender);
    });
  }
  if (data.profile && data.profile.activity) {
    profile.activity = data.profile.activity;
    document.querySelectorAll('#pActivity .pill').forEach(p => {
      p.classList.toggle('checked', p.dataset.v === profile.activity);
    });
  }

  if (data.answers && typeof data.answers === 'object') {
    Object.keys(data.answers).forEach(qName => {
      const a = data.answers[qName];
      if (!a || a.val == null) return;
      answers[qName] = { cat: a.cat, val: a.val };
      const input = form.querySelector('input[name="' + qName + '"][value="' + a.val + '"]');
      if (!input) return;
      const label = input.closest('label');
      const scale = input.closest('.scale');
      if (scale) scale.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
      if (label) label.classList.add('checked');
      input.checked = true;
    });
  }

  updateProgress();
  if (data.shown && Object.keys(answers).length >= total && profileValid()) {
    hasShownResults = true;
    document.getElementById('submitBtn').textContent = '결과 다시 보기';
    renderResults();
    document.getElementById('results').style.display = 'block';
  }
}`
  )

  html = html.replace(
    'answers[qName] = {cat, val: parseInt(label.dataset.v,10)};\n  updateProgress();\n});',
    'answers[qName] = {cat, val: parseInt(label.dataset.v,10)};\n  updateProgress();\n  saveState();\n});'
  )

  html = html.replace(
    "profile.gender = p.dataset.v;\n    checkEnable();\n  });\n});\ndocument.querySelectorAll('#pActivity .pill').forEach(p=>{\n  p.addEventListener('click', ()=>{\n    document.querySelectorAll('#pActivity .pill').forEach(x=>x.classList.remove('checked'));\n    p.classList.add('checked');\n    profile.activity = p.dataset.v;\n    checkEnable();\n  });\n});\n['pAge','pHeight','pWeight'].forEach(id=>{\n  document.getElementById(id).addEventListener('input', checkEnable);\n});",
    "profile.gender = p.dataset.v;\n    checkEnable();\n    saveState();\n  });\n});\ndocument.querySelectorAll('#pActivity .pill').forEach(p=>{\n  p.addEventListener('click', ()=>{\n    document.querySelectorAll('#pActivity .pill').forEach(x=>x.classList.remove('checked'));\n    p.classList.add('checked');\n    profile.activity = p.dataset.v;\n    checkEnable();\n    saveState();\n  });\n});\n['pAge','pHeight','pWeight','pMeds'].forEach(id=>{\n  document.getElementById(id).addEventListener('input', ()=>{ checkEnable(); saveState(); });\n});"
  )

  html = html.replace(
    `document.getElementById('submitBtn').addEventListener('click', ()=>{
  if(!profileValid()){
    document.getElementById('profileWarn').classList.add('show');
    document.querySelector('.profile-card').scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  if(Object.keys(answers).length < total) return;
  renderResults();
  document.getElementById('results').style.display='block';
  document.getElementById('results').scrollIntoView({behavior:'smooth'});
});`,
    `document.getElementById('submitBtn').addEventListener('click', ()=>{
  if(!profileValid()){
    document.getElementById('profileWarn').classList.add('show');
    document.querySelector('.profile-card').scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  if(Object.keys(answers).length < total) return;
  hasShownResults = true;
  document.getElementById('submitBtn').textContent = '결과 다시 보기';
  renderResults();
  saveState();
  document.getElementById('results').style.display='block';
  document.getElementById('results').scrollIntoView({behavior:'smooth'});
});`
  )

  html = html.replace(
    '</script>\n</body>',
    'restoreState();\n</script>\n</body>'
  )
}

const out = path.join(root, 'public', 'diagnosis-app.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, html, 'utf8')
console.log('written', out, fs.statSync(out).size)
console.log({
  pName: html.includes('pName'),
  nameLabel: html.includes('이름 또는'),
  report: html.includes('자가진단 리포트'),
  brand: html.includes('#FF2800'),
  persist: html.includes('okbro-gate-check-v1'),
  restore: html.includes('restoreState()'),
})
