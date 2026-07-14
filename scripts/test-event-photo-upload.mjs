/**
 * Manual check: event photo FormData upload.
 * Usage: node scripts/test-event-photo-upload.mjs [port]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const port = process.argv[2] || '3001'
const base = `http://localhost:${port}`

function loadAdminPassword() {
  const env = fs.readFileSync(path.join(root, '.env.local'), 'utf8')
  const match = env.match(/^ADMIN_PASSWORD=(.*)$/m)
  if (!match) throw new Error('ADMIN_PASSWORD missing')
  return match[1].trim()
}

function tinyPngBytes() {
  // 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
}

async function main() {
  const token = loadAdminPassword()
  const listRes = await fetch(`${base}/api/admin/events`, {
    headers: { 'x-admin-token': token },
  })
  const listJson = await listRes.json()
  if (!listRes.ok) {
    console.error('list failed', listRes.status, listJson)
    process.exit(1)
  }
  const event = (listJson.events ?? [])[0]
  if (!event?.id) {
    console.error('no events')
    process.exit(1)
  }
  console.log('event', event.id, event.name)

  // A) correct multipart (browser-like)
  const fd = new FormData()
  fd.append('file', new Blob([tinyPngBytes()], { type: 'image/png' }), 'tiny.png')
  const okRes = await fetch(`${base}/api/admin/events/${event.id}/photo`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: fd,
  })
  const okText = await okRes.text()
  console.log('A correct FormData:', okRes.status, okText.slice(0, 300))

  // B) wrong Content-Type without boundary
  const badFd = new FormData()
  badFd.append('file', new Blob([tinyPngBytes()], { type: 'image/png' }), 'tiny.png')
  const badRes = await fetch(`${base}/api/admin/events/${event.id}/photo`, {
    method: 'POST',
    headers: {
      'x-admin-token': token,
      'Content-Type': 'multipart/form-data',
    },
    body: badFd,
  })
  const badText = await badRes.text()
  console.log('B manual Content-Type:', badRes.status, badText.slice(0, 300))

  // C) ~11MB body (over default middlewareClientMaxBodySize 10MB)
  const big = Buffer.alloc(11 * 1024 * 1024, 1)
  // wrap as fake jpeg magic + padding so validation may reject type — still exercises formData parse
  big[0] = 0xff
  big[1] = 0xd8
  const bigFd = new FormData()
  bigFd.append('file', new Blob([big], { type: 'image/jpeg' }), 'big.jpg')
  const bigRes = await fetch(`${base}/api/admin/events/${event.id}/photo`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: bigFd,
  })
  const bigText = await bigRes.text()
  console.log('C 11MB FormData:', bigRes.status, bigText.slice(0, 300))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
