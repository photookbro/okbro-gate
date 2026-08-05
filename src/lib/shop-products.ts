import * as XLSX from 'xlsx'

export type ShopProduct = {
  id: string
  product_name: string
  store_name: string
  image_url: string
  price_original: number
  price_discount: number
  affiliate_url: string
  category: string
  display_order: number
  is_active: boolean
  click_count: number
  created_at: string
}

export type ShopProductCsvRow = {
  product_name: string
  store_name: string
  image_url: string
  price_original: number
  price_discount: number
  affiliate_url: string
  category: string
  display_order: number
}

const HEADER_MAP: Record<string, keyof ShopProductCsvRow> = {
  상품명: 'product_name',
  쇼핑몰: 'store_name',
  이미지url: 'image_url',
  이미지URL: 'image_url',
  정가: 'price_original',
  할인가: 'price_discount',
  제휴링크: 'affiliate_url',
  카테고리: 'category',
  순서: 'display_order',
  product_name: 'product_name',
  store_name: 'store_name',
  image_url: 'image_url',
  price_original: 'price_original',
  price_discount: 'price_discount',
  affiliate_url: 'affiliate_url',
  category: 'category',
  display_order: 'display_order',
}

function normalizeHeader(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim()
}

function parsePrice(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

function parseOrder(value: string): number {
  const n = Number(value.replace(/[^\d-]/g, ''))
  return Number.isFinite(n) ? Math.floor(n) : 0
}

/** 간단 CSV 파서 (따옴표 필드 지원) */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    // 완전히 빈 줄 스킵
    if (row.length === 1 && row[0] === '') {
      row = []
      return
    }
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      pushCell()
      continue
    }
    if (ch === '\n') {
      pushCell()
      pushRow()
      continue
    }
    if (ch === '\r') {
      continue
    }
    cell += ch
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell()
    pushRow()
  }

  return rows
}

export function parseShopProductsCsv(text: string): {
  rows: ShopProductCsvRow[]
  errors: string[]
} {
  return parseShopProductsTable(parseCsvText(text))
}

export function parseShopProductsXlsx(buffer: ArrayBuffer): {
  rows: ShopProductCsvRow[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellText: true,
    cellDates: false,
  })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { rows: [], errors: ['시트를 찾지 못했어요'] }
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { rows: [], errors: ['시트를 찾지 못했어요'] }

  const table = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }
  ).map(row => (row ?? []).map(cell => String(cell ?? '').trim()))

  return parseShopProductsTable(table)
}

export function parseShopProductsTable(table: string[][]): {
  rows: ShopProductCsvRow[]
  errors: string[]
} {
  const errors: string[] = []
  if (table.length < 2) {
    return { rows: [], errors: ['헤더와 데이터가 필요해요'] }
  }

  const headers = table[0].map(normalizeHeader)
  const fieldIndexes = new Map<keyof ShopProductCsvRow, number>()

  headers.forEach((h, idx) => {
    const key = HEADER_MAP[h] ?? HEADER_MAP[h.replace(/\s+/g, '')]
    if (key && !fieldIndexes.has(key)) fieldIndexes.set(key, idx)
  })

  if (!fieldIndexes.has('product_name') || !fieldIndexes.has('affiliate_url')) {
    return {
      rows: [],
      errors: ['필수 컬럼이 없어요: 상품명, 제휴링크'],
    }
  }

  const seenUrls = new Set<string>()
  const rows: ShopProductCsvRow[] = []

  for (let r = 1; r < table.length; r++) {
    const line = table[r]
    const get = (key: keyof ShopProductCsvRow) => {
      const idx = fieldIndexes.get(key)
      if (idx == null) return ''
      return (line[idx] ?? '').trim()
    }

    const product_name = get('product_name')
    const affiliate_url = get('affiliate_url')
    if (!product_name && !affiliate_url) continue

    if (!product_name) {
      errors.push(`${r + 1}행: 상품명 없음`)
      continue
    }
    if (!affiliate_url || !/^https?:\/\//i.test(affiliate_url)) {
      errors.push(`${r + 1}행: 제휴링크가 http(s) URL이 아님`)
      continue
    }
    if (seenUrls.has(affiliate_url)) {
      errors.push(`${r + 1}행: 제휴링크 중복 (파일 내)`)
      continue
    }
    seenUrls.add(affiliate_url)

    rows.push({
      product_name,
      store_name: get('store_name'),
      image_url: get('image_url'),
      price_original: parsePrice(get('price_original')),
      price_discount: parsePrice(get('price_discount')),
      affiliate_url,
      category: get('category'),
      display_order: parseOrder(get('display_order')),
    })
  }

  return { rows, errors }
}

export function formatWon(price: number): string {
  return `${Math.max(0, Math.floor(price)).toLocaleString('ko-KR')}원`
}
