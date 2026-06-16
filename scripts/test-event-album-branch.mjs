import assert from 'node:assert/strict'

function resolveEventAlbumBranch(verification) {
  if (verification.gps_passed_at) return 'b-album'
  if (verification.purchase_verified) return 'purchase-modal'
  return 'a-album'
}

const cases = [
  {
    name: 'gps_passed_at → b-album',
    verification: {
      status: 'valid',
      access_source: 'gps',
      gps_passed_at: '2025-09-14T05:32:45Z',
      purchase_verified: true,
    },
    expected: 'b-album',
  },
  {
    name: 'purchase only → purchase-modal',
    verification: {
      status: 'valid',
      access_source: 'purchase',
      purchase_verified: true,
    },
    expected: 'purchase-modal',
  },
  {
    name: 'no purchase → a-album',
    verification: {
      status: 'none',
      purchase_verified: false,
    },
    expected: 'a-album',
  },
]

for (const c of cases) {
  assert.equal(resolveEventAlbumBranch(c.verification), c.expected, c.name)
}

console.log('event-album-branch: all cases passed')
