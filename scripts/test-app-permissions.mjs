import assert from 'node:assert/strict'

function findPermissionGaps(snapshot, stored) {
  const gaps = []
  if (stored.gps && snapshot.gps !== 'granted') gaps.push('gps')
  if (stored.notification && snapshot.notification !== 'granted') gaps.push('notification')
  return gaps
}

function findMissingRuntimePermissions(snapshot) {
  const missing = []
  if (snapshot.gps !== 'granted') missing.push('gps')
  if (snapshot.notification !== 'granted') missing.push('notification')
  return missing
}

assert.deepEqual(
  findPermissionGaps({ gps: 'denied', notification: 'granted' }, { gps: true, notification: true }),
  ['gps']
)

assert.deepEqual(findMissingRuntimePermissions({ gps: 'prompt', notification: 'default' }), [
  'gps',
  'notification',
])

assert.deepEqual(findMissingRuntimePermissions({ gps: 'granted', notification: 'granted' }), [])

console.log('app-permissions logic tests passed')
