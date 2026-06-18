import AuthSection from '@/components/auth-section'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/events')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="page-title text-center">OKbroGATE</h1>
      <AuthSection user={user} />
    </main>
  )
}
