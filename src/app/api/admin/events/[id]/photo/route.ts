import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin } from '@/lib/admin-auth'
import { deleteEventPhoto, uploadEventPhoto } from '@/lib/event-photo-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { id } = await params

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    console.error('[admin/events/photo] POST unexpected content-type:', contentType)
    return NextResponse.json(
      { error: '업로드 요청 형식이 올바르지 않아요 (multipart/form-data가 아님). 새로고침 후 다시 시도해주세요.' },
      { status: 400 }
    )
  }

  try {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (parseError) {
      const contentLength = req.headers.get('content-length')
      console.error('[admin/events/photo] formData parse failed:', {
        contentType,
        contentLength,
        parseError,
      })
      return NextResponse.json(
        {
          error:
            '업로드 본문을 읽지 못했어요. 파일 크기가 큰 경우(약 10MB 초과)라면 서버를 재시작한 뒤 다시 시도하거나, 이미지를 압축해서 올려주세요.',
        },
        { status: 400 }
      )
    }
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지 파일이 필요해요' }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { photoUrl } = await uploadEventPhoto(admin, id, file)

    return NextResponse.json({ success: true, photo_url: photoUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 업로드 실패'
    console.error('[admin/events/photo] POST failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { id } = await params

  try {
    const admin = supabaseAdmin()
    await deleteEventPhoto(admin, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 삭제 실패'
    console.error('[admin/events/photo] DELETE failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
