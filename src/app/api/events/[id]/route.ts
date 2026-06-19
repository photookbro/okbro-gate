import { NextResponse } from 'next/server'
import { fetchEventById } from '@/lib/event-query'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: '대회 ID가 필요해요' }, { status: 400 })
  }

  const { data, error } = await fetchEventById(id)

  if (error) {
    console.error('[events/[id]]', error.message)
    return NextResponse.json({ error: '대회 정보 조회 실패' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: '대회를 찾을 수 없어요' }, { status: 404 })
  }

  return NextResponse.json({ event: data })
}
