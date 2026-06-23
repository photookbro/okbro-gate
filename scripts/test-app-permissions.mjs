import assert from 'node:assert/strict'

function findPermissionGaps(snapshot, stored) {
  return stored.gps && snapshot.gps !== 'granted'
}

function findMissingRuntimePermissions(snapshot) {
  return snapshot.gps !== 'granted'
}

assert.equal(
  findPermissionGaps({ gps: 'denied' }, { gps: true }),
  true
)

assert.equal(findMissingRuntimePermissions({ gps: 'prompt' }), true)
assert.equal(findMissingRuntimePermissions({ gps: 'granted' }), false)

console.log('app-permissions logic tests passed')
