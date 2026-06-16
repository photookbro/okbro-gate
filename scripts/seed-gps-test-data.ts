/**
 * GPS 테스트 데이터 시드
 * - 홍천그란폰도: gps_logs insert (14:32:45)
 * - 손기정마라톤: gps_logs 삭제
 *
 * Run: npx tsx scripts/seed-gps-test-data.ts
 * Optional: USER_ID=uuid npx tsx scripts/seed-gps-test-data.ts
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

async function findEventByName(pattern: string) {
  const { data, error } = await admin.from('events').select('id, name, date').ilike('name', `%${pattern}%`)
  if (error) throw error
  return data?.[0] ?? null
}

async function resolveUserId(): Promise<string> {
  if (process.env.USER_ID) return process.env.USER_ID

  const { data: order } = await admin
    .from('orders')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (order?.user_id) return order.user_id

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error || !data.users[0]?.id) {
    throw new Error('user_id를 찾을 수 없어요. USER_ID 환경변수를 설정해주세요.')
  }
  return data.users[0].id
}

function passedAtOnEventDate(eventDate: string): string {
  return `${eventDate}T14:32:45+09:00`
}

async function main() {
  const hongcheon = await findEventByName('홍천')
  const songijeong = await findEventByName('손기정')

  if (!hongcheon) {
    console.error('홍천그란폰도 대회를 찾을 수 없어요')
    process.exit(1)
  }

  const userId = await resolveUserId()
  console.log('user_id:', userId)

  // 홍천: 기존 로그 삭제 후 테스트 로그 1건 insert
  await admin.from('gps_logs').delete().eq('event_id', hongcheon.id).eq('user_id', userId)

  const passedAt = passedAtOnEventDate(hongcheon.date)
  const { data: inserted, error: insertError } = await admin
    .from('gps_logs')
    .insert({
      user_id: userId,
      event_id: hongcheon.id,
      passed_at: passedAt,
      notified: false,
    })
    .select('id, passed_at')
    .single()

  if (insertError) {
    console.error('홍천 insert 실패:', insertError)
    process.exit(1)
  }

  console.log(`✅ ${hongcheon.name}: gps_log insert (${passedAt})`, inserted?.id)

  // 손기정: 모든 gps_logs 삭제
  if (songijeong) {
    const { error: deleteError, count } = await admin
      .from('gps_logs')
      .delete({ count: 'exact' })
      .eq('event_id', songijeong.id)

    if (deleteError) {
      console.error('손기정 삭제 실패:', deleteError)
      process.exit(1)
    }
    console.log(`✅ ${songijeong.name}: gps_logs ${count ?? 0}건 삭제`)
  } else {
    console.log('⚠️ 손기정마라톤 대회 없음 — 건너뜀')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
