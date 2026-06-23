import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const IMAGE_KEY = 'home_background_image_url'
const POSITION_KEY = 'home_background_position'
const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1452626038306-9fff5e01e25f?auto=format&fit=crop&w=1800&q=80'
const POSITION_CLAMP = 3000

function verifyAdminToken(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')?.trim()
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password || !token) return false
  return token === password
}

function unauthorizedResponse() {
  return NextResponse.json({ error: '관리자 인증이 필요해요' }, { status: 401 })
}

function createSupabaseAdmin(): SupabaseClient {
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

function normalizeSettingValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (value == null) return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim() || null
}

function parsePosition(raw: string | null): { x: number; y: number } {
  if (!raw) return { x: 0, y: 0 }

  try {
    const parsed = JSON.parse(raw) as {
      x?: unknown
      y?: unknown
      offset_x?: unknown
      offset_y?: unknown
    }
    const x = Number(parsed.x ?? parsed.offset_x ?? 0)
    const y = Number(parsed.y ?? parsed.offset_y ?? 0)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 }
    return { x: Math.round(x), y: Math.round(y) }
  } catch {
    return { x: 0, y: 0 }
  }
}

function clampPosition(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, Math.round(position.x))),
    y: Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, Math.round(position.y))),
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminToken(req)) return unauthorizedResponse()

    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('settings')
      .select('key, value')
      .in('key', [IMAGE_KEY, POSITION_KEY])

    if (error) {
      throw error
    }

    const rows = Object.fromEntries((data ?? []).map(row => [row.key, row.value]))
    const imageUrl = normalizeSettingValue(rows[IMAGE_KEY])
    const position = parsePosition(normalizeSettingValue(rows[POSITION_KEY]))

    return NextResponse.json({
      image_url: imageUrl || DEFAULT_IMAGE,
      stored_url: imageUrl,
      is_default: !imageUrl,
      offset_x: position.x,
      offset_y: position.y,
      position,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[admin/home-background] GET failed:', error)
    return NextResponse.json({ error: '배경 이미지 조회 실패', detail: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!verifyAdminToken(req)) return unauthorizedResponse()

    const body = await req.json()
    const x = Number(body.offset_x ?? body.x)
    const y = Number(body.offset_y ?? body.y)

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: 'offset_x, offset_y가 필요해요' }, { status: 400 })
    }

    const position = clampPosition({ x, y })
    const admin = createSupabaseAdmin()
    const { error } = await admin.from('settings').upsert(
      {
        key: POSITION_KEY,
        value: JSON.stringify(position),
      },
      { onConflict: 'key' }
    )

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      offset_x: position.x,
      offset_y: position.y,
      position,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[admin/home-background] PUT failed:', error)
    return NextResponse.json({ error: '배경 위치 저장 실패', detail: message }, { status: 500 })
  }
}
