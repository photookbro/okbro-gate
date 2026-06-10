import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { data, error } = await supabaseAdmin()
    .from('events')
    .select('id, name, date, album_a_url, album_b_url')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: '대회 목록 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ events: data })
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const { name, date, album_a_url, album_b_url } = await req.json()

  if (!name?.trim() || !date) {
    return NextResponse.json({ error: '이름과 날짜는 필수예요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .insert({
      name: name.trim(),
      date,
      album_a_url: album_a_url?.trim() || null,
      album_b_url: album_b_url?.trim() || null,
    })
    .select('id, name, date, album_a_url, album_b_url')
    .single()

  if (error) {
    return NextResponse.json({ error: '대회 추가 실패' }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
  }

  const { name, date, album_a_url, album_b_url } = await req.json()

  if (!name?.trim() || !date) {
    return NextResponse.json({ error: '이름과 날짜는 필수예요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from('events')
    .update({
      name: name.trim(),
      date,
      album_a_url: album_a_url?.trim() || null,
      album_b_url: album_b_url?.trim() || null,
    })
    .eq('id', id)
    .select('id, name, date, album_a_url, album_b_url')
    .single()

  if (error) {
    return NextResponse.json({ error: '대회 수정 실패' }, { status: 500 })
  }

  return NextResponse.json({ event: data })
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id가 필요해요' }, { status: 400 })
  }

  const { error } = await supabaseAdmin().from('events').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: '대회 삭제 실패' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
