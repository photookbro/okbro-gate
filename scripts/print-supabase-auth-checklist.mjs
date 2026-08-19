/**
 * Supabase Auth URL 설정 체크리스트 (커스텀 도메인 okbrogate.com)
 * 실행: node scripts/print-supabase-auth-checklist.mjs
 */

const SITE_URL = 'https://okbrogate.com'
const REDIRECT_URLS = [
  'http://localhost:3000/**',
  'http://127.0.0.1:3000/**',
  'https://okbrogate.com/**',
  'https://www.okbrogate.com/**',
  'https://okbro-gate.vercel.app/**',
]

console.log('=== Supabase Dashboard → Authentication → URL Configuration ===\n')
console.log('Site URL (한 줄):')
console.log(`  ${SITE_URL}\n`)
console.log('Redirect URLs (아래 전부 추가):')
for (const url of REDIRECT_URLS) {
  console.log(`  ${url}`)
}
console.log('\n=== Vercel 환경변수 ===')
console.log('NEXT_PUBLIC_APP_URL: (미설정 권장) 또는 https://okbrogate.com')
console.log('  → okbro-gate.vercel.app 으로 고정되어 있으면 삭제/수정\n')
console.log('=== 브라우저 확인 (로그인 후) ===')
console.log('DevTools → Application → Cookies → okbrogate.com')
console.log('  sb-*-auth-token (또는 .0, .1 청크) 존재 + Max-Age 큰 값\n')
console.log('=== 테스트 ===')
console.log('1. okbrogate.com 에서 Google 로그인')
console.log('2. 브라우저 완전 종료 후 재접속')
console.log('3. MY PAGE 등 로그인 필요 페이지 → 로그인 유지 확인')
