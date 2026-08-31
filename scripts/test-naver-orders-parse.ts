/**
 * Manual check: npx tsx scripts/test-naver-orders-parse.ts
 */
import * as XLSX from 'xlsx'
import { parseNaverOrdersFromXlsx } from '../src/lib/naver-orders-parse'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function buildXlsx(rows: (string | number)[][]): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

const withHeader = buildXlsx([
  ['상품주문번호', '주문번호', '상품명'],
  ['2026082760023691', '2026082776667491', '테스트A'],
  ['2026082760023681', '2026082776667491', '테스트B'],
  ['2026082760023691', '2026082776667491', '중복상품주문'],
  ['not-an-order', '2026082776667491', '스킵'],
  ['12345678', '2026082776667491', '짧은번호스킵'],
])

const parsed = parseNaverOrdersFromXlsx(withHeader)
assert(parsed.length === 2, `expected 2 unique products, got ${parsed.length}`)
assert(parsed[0].product_order_number === '2026082760023691', 'first product')
assert(parsed[0].order_number === '2026082776667491', 'first order')
assert(parsed[1].product_order_number === '2026082760023681', 'second product')
assert(parsed[1].order_number === '2026082776667491', 'shared order')

const leftOnly = buildXlsx([
  ['2025030111111111', '2025030199999999'],
  ['2025030222222222', '2025030288888888'],
])
const parsedLeft = parseNaverOrdersFromXlsx(leftOnly)
assert(parsedLeft.length === 2, `left-only expected 2, got ${parsedLeft.length}`)
assert(parsedLeft[0].order_number === '2025030199999999', 'left-only order col')

console.log('ok: naver orders parse (product + order columns)')
