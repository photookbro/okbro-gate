import fs from 'node:fs'
import assert from 'node:assert/strict'

const aAlbum = fs.readFileSync('src/components/a-album-view.tsx', 'utf8')
const modal = fs.readFileSync('src/components/album-access-modal.tsx', 'utf8')

assert.doesNotMatch(aAlbum, /AlbumAPreview|iframe/)
assert.match(aAlbum, /고화질을 보려면 과일 구매/)
assert.match(aAlbum, /저화소 앨범 보기/)
assert.match(aAlbum, /과일 구매하기/)
assert.match(aAlbum, /https:\/\/smartstore\.naver\.com\/daebakfresh/)
assert.match(aAlbum, /20250608001/)
assert.match(aAlbum, /20250608002/)
assert.match(aAlbum, /20250609001/)
assert.match(aAlbum, /위 주문번호로 인증하면 테스트 가능합니다/)
assert.doesNotMatch(aAlbum, /OKBRO202506001/)

assert.doesNotMatch(modal, /AlbumAPreview/)
assert.match(modal, /AAlbumView/)

console.log('a-album-view layout: ok')
