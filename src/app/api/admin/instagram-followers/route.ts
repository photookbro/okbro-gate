import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chunkArray, parseInstagramFollowersFromHtml } from '@/lib/instagram-followers-parse'
import { matchPendingInstagramFollowClaims } from '@/lib/instagram-follow-approve-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const UPSERT_BATCH_SIZE = 500
const EXISTING_LOOKUP_BATCH_SIZE = 500

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'HTML 파일을 선택해주세요' }, { status: 400 })
  }

  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.html') && file.type !== 'text/html') {
    return NextResponse.json({ error: 'HTML 파일(.html)만 업로드할 수 있어요' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '파일 크기는 25MB 이하여야 해요' }, { status: 400 })
  }

  let html: string
  try {
    html = await file.text()
  } catch {
    return NextResponse.json({ error: '파일 내용을 읽지 못했어요' }, { status: 400 })
  }

  const parsedUsernames = parseInstagramFollowersFromHtml(html)
  if (parsedUsernames.length === 0) {
    return NextResponse.json({ error: '팔로워 아이디를 찾지 못했어요' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const existing = new Set<string>()

  for (const batch of chunkArray(parsedUsernames, EXISTING_LOOKUP_BATCH_SIZE)) {
    const { data, error } = await admin
      .from('instagram_followers')
      .select('username')
      .in('username', batch)

    if (error) {
      console.error('[admin/instagram-followers] lookup', error)
      return NextResponse.json({ error: '기존 팔로워 조회 실패' }, { status: 500 })
    }

    for (const row of data ?? []) {
      if (typeof row.username === 'string') existing.add(row.username)
    }
  }

  const now = new Date().toISOString()
  const rows = parsedUsernames.map(username => ({
    username,
    updated_at: now,
  }))

  for (const batch of chunkArray(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await admin
      .from('instagram_followers')
      .upsert(batch, { onConflict: 'username', ignoreDuplicates: false })

    if (error) {
      console.error('[admin/instagram-followers] upsert', error)
      return NextResponse.json({ error: '팔로워 저장 실패' }, { status: 500 })
    }
  }

  const uniqueCount = parsedUsernames.length
  const newCount = parsedUsernames.filter(username => !existing.has(username)).length
  const updatedCount = uniqueCount - newCount

  let matchResult = {
    approved: 0,
    push_sent: 0,
    push_failed: 0,
    no_subscription: 0,
    manual_unlock_mismatches: 0,
  }
  try {
    matchResult = await matchPendingInstagramFollowClaims(admin, parsedUsernames)
  } catch (error) {
    console.error('[admin/instagram-followers] match', error)
  }

  const matchParts: string[] = []
  if (matchResult.approved > 0) {
    matchParts.push(`대기 중 ${matchResult.approved.toLocaleString('ko-KR')}건 승인`)
  }
  if (matchResult.push_sent > 0) {
    matchParts.push(`푸시 ${matchResult.push_sent.toLocaleString('ko-KR')}건 발송`)
  }
  if (matchResult.manual_unlock_mismatches > 0) {
    matchParts.push(
      `수동 승인 불일치 ${matchResult.manual_unlock_mismatches.toLocaleString('ko-KR')}건`
    )
  }

  return NextResponse.json({
    success: true,
    file_name: file.name,
    total_parsed: uniqueCount,
    unique_count: uniqueCount,
    new_count: newCount,
    updated_count: updatedCount,
    matched_approved: matchResult.approved,
    push_sent: matchResult.push_sent,
    push_failed: matchResult.push_failed,
    no_subscription: matchResult.no_subscription,
    manual_unlock_mismatches: matchResult.manual_unlock_mismatches,
    summary: [
      `총 ${uniqueCount.toLocaleString('ko-KR')}건 중 ${newCount.toLocaleString('ko-KR')}건 신규 추가됨`,
      ...matchParts,
    ].join(' · '),
  })
}
