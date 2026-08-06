/**
 * Manual check: npx tsx scripts/test-naver-orders-parse.ts
 */
import * as XLSX from 'xlsx'
import { parseNaverOrderNumbersFromXlsx } from '../src/lib/naver-orders-parse'

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
  ['상품주문번호', '상품명'],
  ['2025010112345678', '테스트A'],
  ['2025010112345678', '중복'],
  ['2025010299999999', '테스트B'],
  ['not-an-order', '스킵'],
  ['12345678', '짧은번호스킵'],
])

const parsed = parseNaverOrderNumbersFromXlsx(withHeader)
assert(parsed.length === 2, `expected 2 unique, got ${parsed.length}: ${parsed.join(',')}`)
assert(parsed[0] === '2025010112345678', 'first order')
assert(parsed[1] === '2025010299999999', 'second order')

const leftOnly = buildXlsx([
  ['2025030111111111'],
  ['2025030222222222'],
])
const parsedLeft = parseNaverOrderNumbersFromXlsx(leftOnly)
assert(parsedLeft.length === 2, `left-only expected 2, got ${parsedLeft.length}`)

console.log('ok: naver orders parse')
