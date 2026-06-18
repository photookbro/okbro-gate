import assert from 'node:assert/strict'
import { APP_FIRST_LAUNCH_KEY } from '../src/lib/app-first-launch.ts'
import { isBeforeInstallPromptEvent } from '../src/lib/pwa-install.ts'

assert.equal(APP_FIRST_LAUNCH_KEY, 'okbro_app_first_launch_done')

const installEvent = new Event('beforeinstallprompt')
Object.defineProperty(installEvent, 'prompt', {
  value: async () => {},
  enumerable: true,
})
assert.equal(isBeforeInstallPromptEvent(installEvent), true)
assert.equal(isBeforeInstallPromptEvent(new Event('beforeinstallprompt')), false)

console.log('landing PWA helper tests passed')
