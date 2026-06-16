import fs from 'node:fs'
import assert from 'node:assert/strict'

const src = fs.readFileSync('src/components/album-access-modal.tsx', 'utf8')

assert.doesNotMatch(src, /APP_INSTALL|app-install|isAppInstalled|앱 설치/)
assert.match(src, /열람 가능 기간/)
assert.match(src, /고화질 다운로드/)
assert.match(src, /이 링크는 공유하지 마세요/)
assert.match(src, /촬영 감지를 ON/)

console.log('album-access-modal structure: ok')
