/**
 * 날짜가 지난 대회(date < 오늘) 중 gps_enabled=true인 것들을 일괄 OFF 처리.
 * 해당 대회의 user_gps_tracking_prefs도 함께 비활성화됨.
 * Run: npx tsx scripts/migrate-disable-past-gps.ts
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { disableAllUserGpsTrackingPrefsForEvent } from '../src/lib/user-gps-tracking-prefs-server'
import { todayIsoDate } from '../src/lib/date-input'

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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const today = todayIsoDate()

  const { data: events, error } = await admin
    .from('events')
    .select('id, name, date, gps_enabled')
    .eq('gps_enabled', true)
    .lt('date', today)

  if (error) {
    console.error('대회 조회 실패:', error)
    process.exit(1)
  }

  if (!events || events.length === 0) {
    console.log('정리할 대상 없음 (지난 대회 중 gps_enabled=true인 대회 없음)')
    return
  }

  console.log(`대상 ${events.length}건:`, events.map(e => `${e.name} (${e.date})`).join(', '))

  for (const event of events) {
    const { error: updateError } = await admin
      .from('events')
      .update({ gps_enabled: false })
      .eq('id', event.id)

    if (updateError) {
      console.error(`[${event.name}] events.gps_enabled 업데이트 실패:`, updateError)
      continue
    }

    const { error: prefsError } = await disableAllUserGpsTrackingPrefsForEvent(admin, event.id)
    if (prefsError) {
      console.error(`[${event.name}] user_gps_tracking_prefs 비활성화 실패:`, prefsError)
      continue
    }

    console.log(`✅ ${event.name} (${event.date}) 처리 완료`)
  }
}

main().catch(console.error)
