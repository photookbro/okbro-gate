/**
 * Manual: npx tsx scripts/test-shop-products-csv.ts
 */
import { parseShopProductsCsv } from '../src/lib/shop-products'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const sample = `상품명,쇼핑몰,이미지URL,정가,할인가,제휴링크,카테고리
러닝화 A,쿠팡,https://img.example/a.jpg,"129,000","89,000",https://affiliate.example/a,신발
사이클 장갑,네이버,"https://img.example/b.jpg",35000,29000,https://affiliate.example/b,장갑
`

const { rows, errors } = parseShopProductsCsv(sample)
assert(errors.length === 0, `unexpected errors: ${errors.join(', ')}`)
assert(rows.length === 2, `expected 2 rows, got ${rows.length}`)
assert(rows[0].product_name === '러닝화 A', 'name')
assert(rows[0].price_original === 129000, `original ${rows[0].price_original}`)
assert(rows[0].price_discount === 89000, `discount ${rows[0].price_discount}`)
assert(rows[0].category === '신발', 'category')

console.log('ok: shop products csv')
