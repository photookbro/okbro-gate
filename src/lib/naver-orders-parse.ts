import * as XLSX from 'xlsx'
import { isNaverOrderNumberFormat } from '@/lib/naver-order-number'

/**
 * 네이버 판매자센터 주문내역 .xlsx에서 상품주문번호를 추출합니다.
 * - 가능하면 "상품주문번호" 헤더 컬럼을 찾고,
 * - 없으면 맨 왼쪽(0번) 컬럼을 사용합니다.
 * - 엑셀 숫자 정밀도 손실을 피하기 위해 raw:false(문자열)로 읽습니다.
 */
export function parseNaverOrderNumbersFromXlsx(buffer: ArrayBuffer): string[] {
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
  let orderColIndex = 0

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '')
        .replace(/\s+/g, '')
        .trim()
      if (cell === '상품주문번호') {
        headerRowIndex = i
        orderColIndex = c
        break
      }
    }
    if (headerRowIndex >= 0) break
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0

  const seen = new Set<string>()
  const numbers: string[] = []

  for (let i = startRow; i < rows.length; i++) {
    const raw = rows[i]?.[orderColIndex]
    const normalized = normalizeOrderCell(raw)
    if (!normalized) continue
    // 헤더 행을 못 찾은 경우: 첫 셀이 주문번호 형식이 아니면 헤더로 보고 스킵
    if (headerRowIndex < 0 && i === 0 && !isNaverOrderNumberFormat(normalized)) {
      continue
    }
    if (!isNaverOrderNumberFormat(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    numbers.push(normalized)
  }

  return numbers
}

function normalizeOrderCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  // raw:false면 대체로 string. 숫자면 과학적 표기 위험이 있어 문자열 강제.
  const text = String(value).trim()
  if (!text) return ''
  // 하이픈/공백 제거 후 숫자만
  const digits = text.replace(/[\s-]/g, '').replace(/[^\d]/g, '')
  return digits
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
