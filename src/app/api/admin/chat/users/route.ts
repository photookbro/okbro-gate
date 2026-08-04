import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { unauthorizedResponse, verifyAdminToken } from '@/lib/admin-auth'
import { getUserDisplayName } from '@/lib/admin-players'

/** 채팅 시작용 선수 검색 (이메일/표시명) */
export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) return unauthorizedResponse()

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase()
  if (q.length < 1) {
    return NextResponse.json({ users: [] })
  }

  const admin = supabaseAdmin()
  const matched: { id: string; email: string; name: string }[] = []

  let page = 1
  const perPage = 1000
  while (matched.length < 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data.users.length) break

    for (const u of data.users) {
      const email = (u.email ?? '').toLowerCase()
      const name = getUserDisplayName(u).toLowerCase()
      if (email.includes(q) || name.includes(q)) {
        matched.push({
          id: u.id,
          email: u.email ?? '',
          name: getUserDisplayName(u),
        })
        if (matched.length >= 30) break
      }
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return NextResponse.json({ users: matched })
}
