import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/auth-server'
import { TERMS_VERSION } from '@/lib/terms-agreement'

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null
  }
  return req.headers.get('x-real-ip')
}

function formatDbError(error: { message?: string; code?: string; details?: string | null }) {
  return {
    message: error.message ?? 'Unknown error',
    code: error.code ?? null,
    details: error.details ?? null,
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  }

  const ipAddress = getClientIp(req)
  const userAgent = req.headers.get('user-agent')
  const insertPayload = {
    user_id: user.id,
    ip_address: ipAddress,
    user_agent: userAgent,
    version: TERMS_VERSION,
  }

  const cookieStore = await cookies()
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: existing, error: existingError } = await userClient
    .from('terms_agreements')
    .select('id, agreed_at')
    .eq('user_id', user.id)
    .eq('version', TERMS_VERSION)
    .maybeSingle()

  if (existingError) {
    const dbError = formatDbError(existingError)
    console.error('[terms-agree] existing lookup failed:', dbError)

    if (existingError.code === 'PGRST205') {
      return NextResponse.json(
        {
          error: 'terms_agreements 테이블이 없어요. Supabase에서 마이그레이션 SQL을 실행해주세요.',
          db_error: dbError,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: '동의 기록 조회 실패', db_error: dbError },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json({
      success: true,
      already_agreed: true,
      agreed_at: existing.agreed_at,
    })
  }

  const { data, error } = await userClient
    .from('terms_agreements')
    .insert(insertPayload)
    .select('id, agreed_at')
    .single()

  if (!error) {
    return NextResponse.json({
      success: true,
      agreed_at: data.agreed_at,
    })
  }

  const dbError = formatDbError(error)
  console.error('[terms-agree] insert failed (user client):', dbError)

  if (error.code === 'PGRST205') {
    return NextResponse.json(
      {
        error: 'terms_agreements 테이블이 없어요. Supabase에서 마이그레이션 SQL을 실행해주세요.',
        db_error: dbError,
      },
      { status: 500 }
    )
  }

  const admin = supabaseAdmin()
  const { data: adminData, error: adminError } = await admin
    .from('terms_agreements')
    .insert(insertPayload)
    .select('id, agreed_at')
    .single()

  if (!adminError) {
    return NextResponse.json({
      success: true,
      agreed_at: adminData.agreed_at,
    })
  }

  const adminDbError = formatDbError(adminError)
  console.error('[terms-agree] insert failed (admin client):', adminDbError)

  return NextResponse.json(
    {
      error: '동의 기록 저장 실패',
      db_error: adminDbError,
    },
    { status: 500 }
  )
}
