import { supabaseAdmin } from '@/lib/supabase-admin'

export type NotificationRecord = {
  id: string
  title: string
  content: string
  created_at: string
}

function mapNotification(row: {
  id: string
  title: string
  content: string
  created_at: string
}): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
  }
}

export async function fetchLatestNotification(): Promise<NotificationRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .select('id, title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapNotification(data)
}

export async function fetchNotificationById(id: string): Promise<NotificationRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .select('id, title, content, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapNotification(data)
}
