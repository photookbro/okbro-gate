import assert from 'node:assert/strict'
import {
  detectMobilePlatform,
  getNotificationSettingsGuide,
} from '../src/lib/push-permission.ts'

const iosGuide = getNotificationSettingsGuide('ios')
assert.match(iosGuide.title, /iOS/)
assert.ok(iosGuide.steps.some(step => step.includes('설정')))

const androidGuide = getNotificationSettingsGuide('android')
assert.match(androidGuide.title, /Android/)
assert.ok(androidGuide.steps.some(step => step.includes('알림')))

assert.equal(detectMobilePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios')
assert.equal(detectMobilePlatform('Mozilla/5.0 (Linux; Android 14)'), 'android')
assert.equal(detectMobilePlatform('Mozilla/5.0 (Windows NT 10.0)'), 'other')

console.log('push-permission guide: ok')
