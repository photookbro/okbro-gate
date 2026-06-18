import assert from 'node:assert/strict'

const ORDER_DUPLICATE_ERROR =
  '중복 사용 중인 주문번호입니다. 다른 주문번호를 입력해주세요.'

function getDuplicateInfoForOrder(orderNumber, currentUserId, rows, emailByUserId) {
  const normalized = orderNumber.trim()
  const otherUserIds = [
    ...new Set(
      rows
        .filter(row => row.order_number.trim() === normalized && row.user_id !== currentUserId)
        .map(row => row.user_id)
    ),
  ]

  const duplicate_users = otherUserIds.map(user_id => ({
    user_id,
    email: emailByUserId.get(user_id) ?? user_id.slice(0, 8),
  }))

  return {
    is_duplicate: duplicate_users.length > 0,
    duplicate_count: duplicate_users.length,
    duplicate_users,
  }
}

const rows = [
  { user_id: 'user-a', order_number: '2024-01010101-01010101' },
  { user_id: 'user-b', order_number: '2024-01010101-01010101' },
  { user_id: 'user-c', order_number: '2024-02020202-02020202' },
]

const emailByUserId = new Map([
  ['user-b', 'b@example.com'],
  ['user-c', 'c@example.com'],
])

const duplicateForA = getDuplicateInfoForOrder(
  '2024-01010101-01010101',
  'user-a',
  rows,
  emailByUserId
)
assert.equal(duplicateForA.is_duplicate, true)
assert.equal(duplicateForA.duplicate_count, 1)
assert.deepEqual(duplicateForA.duplicate_users, [
  { user_id: 'user-b', email: 'b@example.com' },
])

const uniqueForC = getDuplicateInfoForOrder(
  '2024-02020202-02020202',
  'user-c',
  rows,
  emailByUserId
)
assert.equal(uniqueForC.is_duplicate, false)
assert.equal(uniqueForC.duplicate_count, 0)

assert.match(ORDER_DUPLICATE_ERROR, /중복 사용 중인 주문번호/)

console.log('test-order-duplicate: ok')
