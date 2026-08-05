/**
 * Manual: npx tsx scripts/test-shop-naver-intent.ts
 */
import {
  buildNaverAppIntentUrl,
  isAndroidUserAgent,
  isNaverShoppingUrl,
  resolveShopBuyHref,
} from '../src/lib/shop-naver-intent'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel)'), 'android ua')
assert(!isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'iphone ua')

assert(isNaverShoppingUrl('https://smartstore.naver.com/shop/products/1'), 'smartstore')
assert(isNaverShoppingUrl('https://m.smartstore.naver.com/shop'), 'm.smartstore')
assert(isNaverShoppingUrl('https://shopping.naver.com/catalog/1'), 'shopping')
assert(isNaverShoppingUrl('https://brand.naver.com/brand/products/1'), 'brand')
assert(isNaverShoppingUrl('https://naver.me/abc'), 'naver.me')
assert(!isNaverShoppingUrl('https://coupang.com/vp/products/1'), 'coupang')

const intent = buildNaverAppIntentUrl('https://smartstore.naver.com/foo?bar=1')
assert(intent !== null, 'intent null')
assert(
  intent ===
    'intent://smartstore.naver.com/foo?bar=1#Intent;scheme=https;package=com.nhn.android.search;S.browser_fallback_url=https%3A%2F%2Fsmartstore.naver.com%2Ffoo%3Fbar%3D1;end',
  `intent mismatch: ${intent}`
)

const androidNaver = resolveShopBuyHref(
  'https://shopping.naver.com/x',
  'Mozilla/5.0 (Linux; Android 13)'
)
assert(androidNaver.sameWindow, 'android naver same window')
assert(androidNaver.href.startsWith('intent://'), 'android naver intent')

const iosNaver = resolveShopBuyHref(
  'https://shopping.naver.com/x',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
)
assert(!iosNaver.sameWindow && iosNaver.href === 'https://shopping.naver.com/x', 'ios naver')

const androidCoupang = resolveShopBuyHref(
  'https://www.coupang.com/vp/products/1',
  'Mozilla/5.0 (Linux; Android 13)'
)
assert(
  !androidCoupang.sameWindow && androidCoupang.href === 'https://www.coupang.com/vp/products/1',
  'android coupang'
)

console.log('ok: shop naver intent')
