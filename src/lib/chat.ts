export type ChatSender = 'user' | 'admin'

export type ChatMessageRow = {
  id: string
  user_id: string
  sender: ChatSender
  message: string
  created_at: string
  read_at: string | null
}

export type ChatMessageDto = {
  id: string
  sender: ChatSender
  message: string
  created_at: string
  read_at: string | null
  is_mine: boolean
}

export function normalizeChatMessage(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null
  if (trimmed.length > 2000) return trimmed.slice(0, 2000)
  return trimmed
}

export function toChatMessageDto(
  row: ChatMessageRow,
  viewer: ChatSender
): ChatMessageDto {
  return {
    id: row.id,
    sender: row.sender,
    message: row.message,
    created_at: row.created_at,
    read_at: row.read_at,
    is_mine: row.sender === viewer,
  }
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
