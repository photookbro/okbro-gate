/**
 * photo_ok_bro 오입력 자동승인 3건 회수 (불일치와 동일).
 * Usage: node scripts/revoke-photo-ok-bro-misclaims.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const HANDLE = 'photo_ok_bro'
const MISMATCH_BODY =
  '인스타그램 팔로우가 확인되지 않았어요. @photo_ok_bro 팔로우와 아이디 입력을 다시 확인해주세요'
const TARGET_EMAILS = [
  'soosanta72@gmail.com',
  'sojeong.kkang@gmail.com',
  'piniangs@gmail.com',
]

function loadEnv() {
  const env = {}
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === target)
    if (found) return found
    if (!data.users.length || data.users.length < 1000) break
  }
  return null
}

async function sendMismatchPush(admin, env, userId) {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return { sent: 0, failed: 0, no_sub: 1 }

  webpush.setVapidDetails(env.VAPID_SUBJECT ?? 'mailto:admin@okbro.com', publicKey, privateKey)

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !subs?.length) return { sent: 0, failed: 0, no_sub: 1 }

  const payload = JSON.stringify({
    title: 'OKbroGATE',
    body: MISMATCH_BODY,
    url: '/instagram-follow',
  })

  let sent = 0
  let failed = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      sent++
    } catch {
      failed++
    }
  }
  return { sent, failed, no_sub: 0 }
}

async function main() {
  const env = loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const nowIso = new Date().toISOString()
  const results = []

  for (const email of TARGET_EMAILS) {
    const user = await findUserByEmail(admin, email)
    if (!user) {
      results.push({ email, ok: false, error: 'user not found' })
      continue
    }

    const { data: rows, error } = await admin
      .from('instagram_follow_bonus')
      .select(
        'id, user_id, instagram_handle, status, manually_unlocked, manual_unlock_verified_mismatch, expires_at'
      )
      .eq('user_id', user.id)

    if (error) {
      results.push({ email, ok: false, error: error.message })
      continue
    }

    const targets = (rows ?? []).filter(
      row =>
        row.status === 'pending' &&
        row.manually_unlocked === true &&
        String(row.instagram_handle).trim().toLowerCase() === HANDLE
    )

    if (targets.length === 0) {
      results.push({
        email,
        userId: user.id,
        ok: true,
        revoked: 0,
        note: 'no unlocked pending photo_ok_bro row',
        rows: (rows ?? []).map(r => ({
          handle: r.instagram_handle,
          status: r.status,
          unlocked: r.manually_unlocked,
          mismatch: r.manual_unlock_verified_mismatch,
        })),
      })
      continue
    }

    const pushSummary = { sent: 0, failed: 0, no_sub: 0 }
    for (const row of targets) {
      const { error: updateError } = await admin
        .from('instagram_follow_bonus')
        .update({
          manually_unlocked: false,
          manual_unlock_verified_mismatch: true,
          updated_at: nowIso,
        })
        .eq('id', row.id)
        .eq('status', 'pending')
        .eq('manually_unlocked', true)

      if (updateError) throw updateError

      const push = await sendMismatchPush(admin, env, row.user_id)
      pushSummary.sent += push.sent
      pushSummary.failed += push.failed
      pushSummary.no_sub += push.no_sub
    }

    const { data: after } = await admin
      .from('instagram_follow_bonus')
      .select(
        'instagram_handle, status, manually_unlocked, manual_unlock_verified_mismatch, expires_at'
      )
      .eq('user_id', user.id)
      .ilike('instagram_handle', HANDLE)

    results.push({
      email,
      userId: user.id,
      ok: true,
      revoked: targets.length,
      push: pushSummary,
      after,
    })
  }

  console.log(JSON.stringify(results, null, 2))
  if (results.some(r => r.ok === false)) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
