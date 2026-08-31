import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chunkArray, parseNaverOrdersFromXlsx } from '@/lib/naver-orders-parse'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const UPSERT_BATCH_SIZE = 500

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

  let parsedRows
  try {
    parsedRows = parseNaverOrdersFromXlsx(buffer)
  } catch (error) {
    console.error('[admin/naver-orders/upload] parse', error)
    return NextResponse.json({ error: '엑셀을 해석하지 못했어요' }, { status: 400 })
  }

  if (parsedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          '상품주문번호·주문번호를 찾지 못했어요. A열(상품주문번호), B열(주문번호)을 확인해주세요.',
      },
      { status: 400 }
    )
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { error: clearError } = await admin
    .from('verified_naver_orders')
    .delete()
    .not('product_order_number', 'is', null)

  if (clearError) {
    console.error('[admin/naver-orders/upload] clear', clearError)
    return NextResponse.json({ error: '기존 주문 목록 삭제 실패' }, { status: 500 })
  }

  const rows = parsedRows.map(row => ({
    product_order_number: row.product_order_number,
    order_number: row.order_number,
    imported_at: now,
  }))

  for (const batch of chunkArray(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await admin.from('verified_naver_orders').insert(batch)

    if (error) {
      console.error('[admin/naver-orders/upload] insert', error)
      return NextResponse.json({ error: '주문번호 저장 실패' }, { status: 500 })
    }
  }

  const uniqueOrders = new Set(parsedRows.map(row => row.order_number)).size

  return NextResponse.json({
    success: true,
    file_name: file.name,
    total_parsed: parsedRows.length,
    unique_order_numbers: uniqueOrders,
    new_count: parsedRows.length,
    updated_count: 0,
    summary: `상품주문번호 ${parsedRows.length.toLocaleString('ko-KR')}건 · 주문번호 ${uniqueOrders.toLocaleString('ko-KR')}건 저장됨 (기존 목록 교체)`,
  })
}
