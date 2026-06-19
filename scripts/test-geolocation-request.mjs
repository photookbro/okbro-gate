import assert from 'node:assert/strict'
import { PRECISE_GEOLOCATION_OPTIONS } from '../src/lib/geolocation-request.ts'

assert.equal(PRECISE_GEOLOCATION_OPTIONS.enableHighAccuracy, true)
assert.equal(PRECISE_GEOLOCATION_OPTIONS.maximumAge, 0)

console.log('geolocation request helper tests passed')
