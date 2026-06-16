import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf8')
function envVal(key) {
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? ''
}

const supabase = createClient(
  envVal('NEXT_PUBLIC_SUPABASE_URL'),
  envVal('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } }
)

function resolveEventAlbumBranch(verification) {
  if (verification.gps_passed_at) return 'b-album'
  if (verification.purchase_verified) return 'purchase-modal'
  return 'a-album'
}

const GPS_USER = '2b10b488-2d8c-49fd-adff-eb091c10b6c0'
const HONGCHON = '6f7c7126-92e4-46e0-8518-baf276a07f80'
const SONGGI = '4ffa65ff-803b-49fc-b7a1-1eb1bba68ee9'

async function buildVerification(userId, eventId) {
  const [{ data: order }, { data: settings }, { data: gpsLog }] = await Promise.all([
    supabase
      .from('orders')
      .select('order_number, used_at, created_at, expires_at')
      .eq('user_id', userId)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('settings').select('key, value').eq('key', 'verified_period_months'),
    supabase
      .from('gps_logs')
      .select('passed_at')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .order('passed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const months = Number(settings?.find(s => s.key === 'verified_period_months')?.value ?? NaN)
  let purchaseVerified = false
  if (order?.used_at || order?.created_at) {
    const verifiedAt = new Date(order.used_at || order.created_at)
    const expiresAt = order.expires_at
      ? new Date(order.expires_at)
      : new Date(verifiedAt.getFullYear(), verifiedAt.getMonth() + months, verifiedAt.getDate())
    purchaseVerified = expiresAt > new Date()
  }

  if (gpsLog?.passed_at) {
    return {
      gps_passed_at: gpsLog.passed_at,
      purchase_verified: purchaseVerified,
    }
  }

  return { purchase_verified: purchaseVerified && !!order }
}

const hongchon = await buildVerification(GPS_USER, HONGCHON)
const songgi = await buildVerification(GPS_USER, SONGGI)

console.log('홍천그란폰도 branch:', resolveEventAlbumBranch(hongchon), hongchon)
console.log('손기정마라톤 branch:', resolveEventAlbumBranch(songgi), songgi)

if (!hongchon.gps_passed_at) {
  console.error('FAIL: expected gps_passed_at for 홍천')
  process.exit(1)
}
if (resolveEventAlbumBranch(hongchon) !== 'b-album') {
  console.error('FAIL: 홍천 should be b-album')
  process.exit(1)
}
if (resolveEventAlbumBranch(songgi) !== 'purchase-modal') {
  console.error('FAIL: 손기정 should be purchase-modal (purchase O, gps X)')
  process.exit(1)
}

const pageRes = await fetch(`http://localhost:3003/events/${HONGCHON}`)
console.log('Event page HTTP:', pageRes.status)

console.log('integration: ok')
