/**
 * Canonical order duplicate logic check
 * npx tsx scripts/test-naver-order-resolve.ts
 */
import assert from 'node:assert/strict'

// Inline minimal test without DB — verify lookup map behavior conceptually
const verifiedRows = [
  { product_order_number: '2026082760023691', order_number: '2026082776667491' },
  { product_order_number: '2026082760023681', order_number: '2026082776667491' },
]

function buildLookup(rows: typeof verifiedRows, inputs: string[]): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const input of inputs) {
    const byProduct = rows.find(r => r.product_order_number === input)
    if (byProduct) {
      lookup.set(input, byProduct.order_number)
      continue
    }
    const byOrder = rows.find(r => r.order_number === input)
    if (byOrder) {
      lookup.set(input, byOrder.order_number)
    }
  }
  return lookup
}

const lookup = buildLookup(verifiedRows, [
  '2026082760023691',
  '2026082760023681',
  '2026082776667491',
])

assert.equal(lookup.get('2026082760023691'), '2026082776667491')
assert.equal(lookup.get('2026082760023681'), '2026082776667491')
assert.equal(lookup.get('2026082776667491'), '2026082776667491')

// Same canonical → second auth should be duplicate
const canonicals = [...lookup.values()]
assert.equal(new Set(canonicals).size, 1)

console.log('ok: naver order canonical resolve logic')
