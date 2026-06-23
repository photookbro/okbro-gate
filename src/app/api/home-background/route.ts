import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const IMAGE_KEY = 'home_background_image_url'
const POSITION_KEY = 'home_background_position'
const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1452626038306-9fff5e01e25f?auto=format&fit=crop&w=1800&q=80'

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

export async function GET() {
  try {
    const admin = supabaseAdmin()
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
      is_default: !imageUrl,
      offset_x: position.x,
      offset_y: position.y,
      position,
    })
  } catch (error) {
    console.error('[home-background] load failed:', error)
    return NextResponse.json({ error: '배경 이미지 조회 실패' }, { status: 500 })
  }
}
