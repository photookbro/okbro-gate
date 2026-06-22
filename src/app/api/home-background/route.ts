import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveHomeBackgroundImageUrl } from '@/lib/home-background'
import { loadHomeBackgroundSettings } from '@/lib/home-background-server'

export async function GET() {
  try {
    const admin = supabaseAdmin()
    const settings = await loadHomeBackgroundSettings(admin)

    return NextResponse.json({
      image_url: resolveHomeBackgroundImageUrl(settings.imageUrl),
      is_default: !settings.imageUrl,
      offset_x: settings.position.x,
      offset_y: settings.position.y,
      position: settings.position,
    })
  } catch (error) {
    console.error('[home-background] load failed:', error)
    return NextResponse.json({ error: '배경 이미지 조회 실패' }, { status: 500 })
  }
}
