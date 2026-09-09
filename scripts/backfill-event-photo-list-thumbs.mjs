/**
 * 기존 대회 photo_url 원본에서 목록용 -list.webp 생성·업로드
 * node scripts/backfill-event-photo-list-thumbs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnv() {
  const raw = fs.readFileSync(path.join(root, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const LIST_MAX_WIDTH = 480
const LIST_MAX_BYTES = 120 * 1024
const BUCKET = 'site-assets'

async function optimizeList(input) {
  const meta = await sharp(input, { failOn: 'none' }).rotate().metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable image')

  let width = Math.min(meta.width, LIST_MAX_WIDTH)
  let quality = 78

  for (let attempt = 0; attempt < 14; attempt++) {
    const buffer = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toBuffer()
    if (buffer.length <= LIST_MAX_BYTES) return buffer
    if (quality > 45) {
      quality -= 8
      continue
    }
    if (width > 320) {
      width = Math.max(320, width - 80)
      quality = 72
      continue
    }
    quality = Math.max(35, quality - 5)
  }
  throw new Error('could not compress list thumb')
}

function eventIdFromPhotoUrl(photoUrl) {
  try {
    const u = new URL(photoUrl)
    const m = u.pathname.match(/\/event-photos\/([^/]+)\.(webp|jpe?g|png)$/i)
    if (!m) return null
    return m[1].replace(/-list$/i, '')
  } catch {
    return null
  }
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: events, error } = await admin
  .from('events')
  .select('id, name, photo_url')
  .not('photo_url', 'is', null)

if (error) {
  console.error(error)
  process.exit(1)
}

let ok = 0
let skip = 0
let fail = 0

for (const event of events ?? []) {
  const eventId = eventIdFromPhotoUrl(event.photo_url) ?? event.id
  const listPath = `event-photos/${eventId}-list.webp`

  const existing = await admin.storage.from(BUCKET).list('event-photos', {
    search: `${eventId}-list.webp`,
    limit: 5,
  })
  const already = (existing.data ?? []).some(f => f.name === `${eventId}-list.webp`)
  if (already) {
    skip += 1
    console.log('skip', event.name)
    continue
  }

  try {
    const srcPathMatch = String(event.photo_url).match(
      /\/storage\/v1\/object\/public\/site-assets\/(event-photos\/[^?]+)/
    )
    if (!srcPathMatch) {
      fail += 1
      console.error('no path', event.name, event.photo_url)
      continue
    }
    const srcPath = srcPathMatch[1]
    const downloaded = await admin.storage.from(BUCKET).download(srcPath)
    if (downloaded.error || !downloaded.data) {
      fail += 1
      console.error('download', event.name, downloaded.error?.message)
      continue
    }
    const input = Buffer.from(await downloaded.data.arrayBuffer())
    const listBuf = await optimizeList(input)
    const up = await admin.storage.from(BUCKET).upload(listPath, listBuf, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '86400',
    })
    if (up.error) {
      fail += 1
      console.error('upload', event.name, up.error.message)
      continue
    }
    ok += 1
    console.log('ok', event.name, `${Math.round(listBuf.length / 1024)}KB`)
  } catch (e) {
    fail += 1
    console.error('fail', event.name, e?.message || e)
  }
}

console.log(JSON.stringify({ total: events?.length ?? 0, ok, skip, fail }, null, 2))
