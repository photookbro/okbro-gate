import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import {
  chunkArray,
  parseNaverOrderNumbersFromXlsx,
} from '@/lib/naver-orders-parse'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const UPSERT_BATCH_SIZE = 500
const EXISTING_LOOKUP_BATCH_SIZE = 500

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽지 못했어요' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '엑셀 파일을 선택해주세요' }, { status: 400 })
  }

  const lowerName = file.name.toLowerCase()
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
    return NextResponse.json({ error: '엑셀 파일(.xlsx)만 업로드할 수 있어요' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: '파일 크기는 25MB 이하여야 해요' }, { status: 400 })
  }

  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: '파일 내용을 읽지 못했어요' }, { status: 400 })
  }

  let orderNumbers: string[]
  try {
    orderNumbers = parseNaverOrderNumbersFromXlsx(buffer)
  } catch (error) {
    console.error('[admin/naver-orders/upload] parse', error)
    return NextResponse.json({ error: '엑셀을 해석하지 못했어요' }, { status: 400 })
  }

  if (orderNumbers.length === 0) {
    return NextResponse.json(
      { error: '상품주문번호를 찾지 못했어요. 맨 왼쪽 컬럼을 확인해주세요.' },
      { status: 400 }
    )
  }

  const admin = supabaseAdmin()
  const existing = new Set<string>()

  for (const batch of chunkArray(orderNumbers, EXISTING_LOOKUP_BATCH_SIZE)) {
    const { data, error } = await admin
      .from('verified_naver_orders')
      .select('order_number')
      .in('order_number', batch)

    if (error) {
      console.error('[admin/naver-orders/upload] lookup', error)
      return NextResponse.json({ error: '기존 주문번호 조회 실패' }, { status: 500 })
    }

    for (const row of data ?? []) {
      if (typeof row.order_number === 'string') existing.add(row.order_number)
    }
  }

  const now = new Date().toISOString()
  const rows = orderNumbers.map(order_number => ({
    order_number,
    imported_at: now,
  }))

  for (const batch of chunkArray(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await admin
      .from('verified_naver_orders')
      .upsert(batch, { onConflict: 'order_number', ignoreDuplicates: false })

    if (error) {
      console.error('[admin/naver-orders/upload] upsert', error)
      return NextResponse.json({ error: '주문번호 저장 실패' }, { status: 500 })
    }
  }

  const uniqueCount = orderNumbers.length
  const newCount = orderNumbers.filter(n => !existing.has(n)).length

  return NextResponse.json({
    success: true,
    file_name: file.name,
    total_parsed: uniqueCount,
    new_count: newCount,
    updated_count: uniqueCount - newCount,
    summary: `총 ${uniqueCount.toLocaleString('ko-KR')}건 중 ${newCount.toLocaleString('ko-KR')}건 신규 추가됨`,
  })
}
