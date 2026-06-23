import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const KEYS = ['home_background_image_url', 'home_background_position'] as const

export async function GET() {
  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin.from('settings').select('key, value').in('key', [...KEYS])

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          stage: 'db_query',
          error: error.message,
          code: error.code,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      row_count: data?.length ?? 0,
      rows: data ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        stage: 'unexpected',
        error: message,
      },
      { status: 500 }
    )
  }
}
