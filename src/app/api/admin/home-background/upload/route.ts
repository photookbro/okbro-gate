import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')?.trim()
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password || !token) return false
  return token === password
}

function unauthorizedResponse() {
  return NextResponse.json({ error: '관리자 인증이 필요해요' }, { status: 401 })
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    const missing = [
      !url ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean)
    throw new Error(`Missing env: ${missing.join(', ')}`)
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyAdminToken(req)) return unauthorizedResponse()

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '이미지 파일이 필요해요' }, { status: 400 })
    }

    const { DEFAULT_HOME_BACKGROUND_POSITION, formatHomeBackgroundUploadError, validateHomeBackgroundFile } =
      await import('@/lib/home-background')
    const { saveHomeBackgroundImageUrl, saveHomeBackgroundPosition } =
      await import('@/lib/home-background-settings-server')
    const { uploadHomeBackgroundImage } = await import('@/lib/home-background-server')

    const validationError = validateHomeBackgroundFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
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
    const { formatHomeBackgroundUploadError } = await import('@/lib/home-background')
    const message =
      error instanceof Error && !('statusCode' in error)
        ? error.message
        : formatHomeBackgroundUploadError(error as { message?: string })

    console.error('[admin/home-background/upload] POST failed:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
