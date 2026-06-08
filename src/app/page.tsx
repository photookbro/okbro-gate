import AuthSection from '@/components/auth-section'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-semibold">오켱사진링크게이트</h1>
      <AuthSection user={user} />
    </main>
  )
}
