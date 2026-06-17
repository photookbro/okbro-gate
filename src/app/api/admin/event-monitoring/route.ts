import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { formatPassTimeSeconds } from '@/lib/geo'
import { emailToUsername } from '@/lib/shoot-record'
import { getUserDisplayName } from '@/lib/admin-players'
import type { User } from '@supabase/supabase-js'

async function buildPlayerLabelMap(admin: ReturnType<typeof supabaseAdmin>) {
  const labelByUserId = new Map<string, string>()

  const { data: usersRows } = await admin.from('users').select('id, email')
  for (const user of usersRows ?? []) {
    if (!user.id) continue
    labelByUserId.set(user.id, user.email ?? user.id.slice(0, 8))
  }

  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break

    for (const user of data.users) {
      if (!user.id) continue
      labelByUserId.set(user.id, getUserDisplayName(user as User))
    }

    if (data.users.length < perPage) break
    page++
  }

  return labelByUserId
}

function formatPlayerLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '-'
  if (trimmed.includes('@')) return emailToUsername(trimmed)
  return trimmed
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) {
    return NextResponse.json({ error: 'event_id가 필요해요' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const [{ data: event, error: eventError }, logsResult, { data: orders }] =
    await Promise.all([
      admin.from('events').select('id, name, date').eq('id', eventId).maybeSingle(),
      admin
        .from('gps_logs')
        .select('id, user_id, passed_at, pass_count, location_number, notified')
        .eq('event_id', eventId)
        .order('passed_at', { ascending: false }),
      admin.from('orders').select('user_id').eq('event_id', eventId),
    ])

  let logs = logsResult.data
  if (logsResult.error) {
    const fallback = await admin
      .from('gps_logs')
      .select('id, user_id, passed_at, notified')
      .eq('event_id', eventId)
      .order('passed_at', { ascending: false })
    if (fallback.error) {
      console.error('[admin/event-monitoring]', fallback.error)
      return NextResponse.json({ error: 'GPS 로그 조회 실패' }, { status: 500 })
    }
    logs = (fallback.data ?? []).map((log, index) => ({
      ...log,
      pass_count: index + 1,
      location_number: 1,
    }))
  }

  if (eventError || !event) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  const labelByUserId = await buildPlayerLabelMap(admin)
  const usersWithLogs = new Set<string>()

  const rows = (logs ?? []).map(log => {
    if (log.user_id) usersWithLogs.add(log.user_id)
    const rawLabel = log.user_id ? (labelByUserId.get(log.user_id) ?? log.user_id.slice(0, 8)) : '-'
    return {
      id: log.id,
      user_id: log.user_id,
      player_label: formatPlayerLabel(rawLabel),
      gps_passed: true,
      passed_at: log.passed_at,
      passed_at_display: log.passed_at ? formatPassTimeSeconds(new Date(log.passed_at)) : null,
      pass_count: log.pass_count ?? 1,
      location_number: log.location_number ?? 1,
      notified: log.notified === true,
    }
  })

  const purchaserIds = new Set<string>()
  for (const order of orders ?? []) {
    if (order.user_id && !usersWithLogs.has(order.user_id)) {
      purchaserIds.add(order.user_id)
    }
  }

  for (const userId of purchaserIds) {
    const rawLabel = labelByUserId.get(userId) ?? userId.slice(0, 8)
    rows.push({
      id: `no-log-${userId}`,
      user_id: userId,
      player_label: formatPlayerLabel(rawLabel),
      gps_passed: false,
      passed_at: null,
      passed_at_display: null,
      pass_count: null,
      location_number: null,
      notified: false,
    })
  }

  rows.sort((a, b) => {
    const nameCmp = a.player_label.localeCompare(b.player_label, 'ko')
    if (nameCmp !== 0) return nameCmp
    if (!a.gps_passed && b.gps_passed) return 1
    if (a.gps_passed && !b.gps_passed) return -1
    const passA = a.pass_count ?? 0
    const passB = b.pass_count ?? 0
    return passA - passB
  })

  return NextResponse.json({
    event: { id: event.id, name: event.name, date: event.date },
    rows,
  })
}
