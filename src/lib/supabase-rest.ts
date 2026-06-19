const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function assertSupabaseEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or anon key is not configured')
  }
}
export function supabaseAnonRestHeaders(
  extra?: HeadersInit
): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    ...(extra as Record<string, string> | undefined),
  }
}

export async function supabaseRestFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  assertSupabaseEnv()  const headers = {
    ...supabaseAnonRestHeaders(),
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }

  return fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers,
  })
}

export async function supabaseRestGet<T>(path: string): Promise<{
  data: T | null
  error: Error | null
}> {
  const res = await supabaseRestFetch(path)

  if (!res.ok) {
    const message = await res.text()
    return { data: null, error: new Error(message || res.statusText) }
  }

  return { data: (await res.json()) as T, error: null }
}
