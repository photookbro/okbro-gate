import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import {
  DEFAULT_HOME_BACKGROUND_POSITION,
  formatHomeBackgroundUploadError,
  resolveHomeBackgroundImageUrl,
  validateHomeBackgroundFile,
} from '@/lib/home-background'
import {
  loadHomeBackgroundSettings,
  saveHomeBackgroundImageUrl,
  saveHomeBackgroundPosition,
} from '@/lib/home-background-settings-server'
import { uploadHomeBackgroundImage } from '@/lib/home-background-server'

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  try {
    const admin = supabaseAdmin()
    const settings = await loadHomeBackgroundSettings(admin)

    return NextResponse.json({
      image_url: resolveHomeBackgroundImageUrl(settings.imageUrl),
      stored_url: settings.imageUrl,
      is_default: !settings.imageUrl,
      offset_x: settings.position.x,
      offset_y: settings.position.y,
      position: settings.position,
    })
  } catch (error) {
    console.error('[admin/home-background] load failed:', error)
    return NextResponse.json({ error: '배경 이미지 조회 실패' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '이미지 파일이 필요해요' }, { status: 400 })
  }

  const validationError = validateHomeBackgroundFile(file)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const admin = supabaseAdmin()

  try {
    const uploadResult = await uploadHomeBackgroundImage(admin, file)
    await Promise.all([
      saveHomeBackgroundImageUrl(admin, uploadResult.imageUrl),
      saveHomeBackgroundPosition(admin, DEFAULT_HOME_BACKGROUND_POSITION),
    ])

    return NextResponse.json({
      success: true,
      image_url: uploadResult.imageUrl,
      is_default: false,
      stored_bytes: uploadResult.storedBytes,
      output_width: uploadResult.outputWidth,
      output_height: uploadResult.outputHeight,
      offset_x: 0,
      offset_y: 0,
      position: DEFAULT_HOME_BACKGROUND_POSITION,
    })
  } catch (error) {
    const message =
      error instanceof Error && !('statusCode' in error)
        ? error.message
        : formatHomeBackgroundUploadError(error as { message?: string })

    console.error('[admin/home-background] upload failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const body = await req.json()
  const x = Number(body.offset_x ?? body.x)
  const y = Number(body.offset_y ?? body.y)

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return NextResponse.json({ error: 'offset_x, offset_y가 필요해요' }, { status: 400 })
  }

  try {
    const admin = supabaseAdmin()
    const position = await saveHomeBackgroundPosition(admin, { x, y })

    return NextResponse.json({
      success: true,
      offset_x: position.x,
      offset_y: position.y,
      position,
    })
  } catch (error) {
    console.error('[admin/home-background] position save failed:', error)
    return NextResponse.json({ error: '배경 위치 저장 실패' }, { status: 500 })
  }
}
