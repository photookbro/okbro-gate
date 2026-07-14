'use client'

import { createClient } from '@/lib/supabase/client'
import { buildAuthCallbackUrl } from '@/lib/app-origin'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function AuthSection({ user }: { user: User | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildAuthCallbackUrl('/'),
      },
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.refresh()
  }

  if (user) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3">
        <p className="text-sm text-gray-600">{user.email}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          LOG OUT
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="mt-4 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
    >
      구글 로그인
    </button>
  )
}
