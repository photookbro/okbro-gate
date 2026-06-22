import assert from 'node:assert/strict'
import fs from 'node:fs'

function resolveImageMimeType(file) {
  const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
  const normalized = (file.type || '').trim().toLowerCase()
  if (normalized === 'image/jpg') return 'image/jpeg'
  if (ALLOWED.has(normalized)) return normalized

  const name = (file.name || '').trim().toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

assert.equal(resolveImageMimeType({ name: 'photo.jpg', type: '' }), 'image/jpeg')
assert.equal(resolveImageMimeType({ name: 'photo.png', type: '' }), 'image/png')
console.log('home-background helpers: ok')

let env = ''
try {
  env = fs.readFileSync('.env.local', 'utf8')
} catch {
  console.log('storage probe skipped (.env.local missing)')
  process.exit(0)
}

function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const url = envVal('NEXT_PUBLIC_SUPABASE_URL')
const serviceKey = envVal('SUPABASE_SERVICE_ROLE_KEY')
const adminToken = envVal('ADMIN_PASSWORD')

if (!url || !serviceKey) {
  console.log('storage probe skipped (supabase env missing)')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: buckets, error: listError } = await admin.storage.listBuckets()
console.log('listBuckets:', listError?.message ?? `ok (${buckets?.length ?? 0} buckets)`)
const hasBucket = buckets?.some(b => b.id === 'site-assets' || b.name === 'site-assets')
console.log('site-assets bucket:', hasBucket ? 'exists' : 'missing')

if (!hasBucket) {
  const { error: createError } = await admin.storage.createBucket('site-assets', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  console.log('createBucket:', createError?.message ?? 'ok')
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const { error: uploadError } = await admin.storage
  .from('site-assets')
  .upload('home-background.png', tinyPng, {
    upsert: true,
    contentType: 'image/png',
  })

console.log('upload probe:', uploadError?.message ?? 'ok')

if (adminToken) {
  const formData = new FormData()
  formData.append(
    'file',
    new File([tinyPng], 'probe.png', { type: 'image/png' })
  )

  try {
    const res = await fetch('http://127.0.0.1:3000/api/admin/home-background', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: formData,
    })
    const body = await res.json()
    console.log('HTTP probe:', res.status, body.error ?? body.image_url ?? body)
  } catch (err) {
    console.log('HTTP probe skipped:', err.message)
  }
}
