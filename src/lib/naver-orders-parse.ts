import * as XLSX from 'xlsx'
import { isNaverOrderNumberFormat } from '@/lib/naver-order-number'
import { normalizeNaverOrderDigits } from '@/lib/naver-order-resolve'

export type NaverOrderImportRow = {
  product_order_number: string
  order_number: string
}

const HEADER_PRODUCT = '상품주문번호'
const HEADER_ORDER = '주문번호'

/**
 * 네이버 판매자센터 주문내역 .xlsx에서 상품주문번호(A) + 주문번호(B)를 추출합니다.
 * - "상품주문번호", "주문번호" 헤더 컬럼을 찾고
 * - 없으면 A열(0)=상품주문번호, B열(1)=주문번호 로 읽습니다.
 */
export function parseNaverOrdersFromXlsx(buffer: ArrayBuffer): NaverOrderImportRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellText: true,
    cellDates: false,
  })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }
  )

  if (rows.length === 0) return []

  let headerRowIndex = -1
  let productColIndex = 0
  let orderColIndex = 1

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? []
    let foundProduct = -1
    let foundOrder = -1

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '')
        .replace(/\s+/g, '')
        .trim()
      if (cell === HEADER_PRODUCT) foundProduct = c
      if (cell === HEADER_ORDER) foundOrder = c
    }

    if (foundProduct >= 0 || foundOrder >= 0) {
      headerRowIndex = i
      if (foundProduct >= 0) productColIndex = foundProduct
      if (foundOrder >= 0) orderColIndex = foundOrder
      break
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0
  const seenProducts = new Set<string>()
  const result: NaverOrderImportRow[] = []

  for (let i = startRow; i < rows.length; i++) {
    const line = rows[i] ?? []
    const product_order_number = normalizeNaverOrderDigits(line[productColIndex])
    const order_number = normalizeNaverOrderDigits(line[orderColIndex])

    if (!product_order_number && !order_number) continue

    if (headerRowIndex < 0 && i === 0) {
      if (!isNaverOrderNumberFormat(product_order_number)) continue
    }

    if (!isNaverOrderNumberFormat(product_order_number)) continue
    if (!isNaverOrderNumberFormat(order_number)) continue
    if (seenProducts.has(product_order_number)) continue

    seenProducts.add(product_order_number)
    result.push({ product_order_number, order_number })
  }

  return result
}

/** @deprecated parseNaverOrdersFromXlsx 사용 */
export function parseNaverOrderNumbersFromXlsx(buffer: ArrayBuffer): string[] {
  return parseNaverOrdersFromXlsx(buffer).map(row => row.product_order_number)
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
