import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  chunkArray,
  mergeInstagramFollowerUsernames,
  parseInstagramFollowersFromHtml,
} from '@/lib/instagram-followers-parse'
import { matchPendingInstagramFollowClaims } from '@/lib/instagram-follow-approve-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_FILE_COUNT = 20
const UPSERT_BATCH_SIZE = 500
const EXISTING_LOOKUP_BATCH_SIZE = 500

function collectHtmlFiles(formData: FormData): File[] {
  const files: File[] = []
  for (const value of formData.getAll('file')) {
    if (value instanceof File && value.size > 0) files.push(value)
  }
  return files
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
  }

  const files = collectHtmlFiles(formData)
  if (files.length === 0) {
    return NextResponse.json({ error: 'HTML 파일을 선택해주세요' }, { status: 400 })
  }
  if (files.length > MAX_FILE_COUNT) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_FILE_COUNT}개까지 업로드할 수 있어요` },
      { status: 400 }
    )
  }

  const parsedLists: string[][] = []
  const fileNames: string[] = []

  for (const file of files) {
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.html') && file.type !== 'text/html') {
      return NextResponse.json(
        { error: `HTML 파일(.html)만 업로드할 수 있어요: ${file.name}` },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `파일 크기는 25MB 이하여야 해요: ${file.name}` },
        { status: 400 }
      )
    }

    let html: string
    try {
      html = await file.text()
    } catch {
      return NextResponse.json(
        { error: `파일 내용을 읽지 못했어요: ${file.name}` },
        { status: 400 }
      )
    }

    parsedLists.push(parseInstagramFollowersFromHtml(html))
    fileNames.push(file.name)
  }

  const parsedUsernames = mergeInstagramFollowerUsernames(parsedLists)
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

  // 기존 DB에 다른 대소문자로 저장된 경우도 신규로 치지 않도록 소문자 기준 비교
  const existingLower = new Set([...existing].map(u => u.toLowerCase()))

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
  const newCount = parsedUsernames.filter(
    username => !existing.has(username) && !existingLower.has(username.toLowerCase())
  ).length
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

  const fileLabel =
    fileNames.length === 1
      ? fileNames[0]
      : `${fileNames.join(', ')} (${fileNames.length}개)`

  return NextResponse.json({
    success: true,
    file_name: fileLabel,
    file_names: fileNames,
    file_count: fileNames.length,
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
      `파일 ${fileNames.length.toLocaleString('ko-KR')}개 · 총 ${uniqueCount.toLocaleString('ko-KR')}건 중 ${newCount.toLocaleString('ko-KR')}건 신규 추가됨`,
      ...matchParts,
    ].join(' · '),
  })
}
