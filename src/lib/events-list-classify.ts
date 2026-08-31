export type EventListRow = {
  id: string
  name: string
  date: string
  album_b_url?: string | null
}

export function hasEventAlbum(event: Pick<EventListRow, 'album_b_url'>): boolean {
  return typeof event.album_b_url === 'string' && event.album_b_url.trim().length > 0
}

export function todayDateStringInKorea(from = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(from)
}

/** KST 기준 오늘(또는 from)부터 days일 뒤 날짜 (YYYY-MM-DD). */
export function kstDateStringPlusDays(days: number, from = new Date()): string {
  const base = todayDateStringInKorea(from)
  const [year, month, day] = base.split('-').map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day + days)
  return todayDateStringInKorea(new Date(utcMidnight))
}

export function twelveMonthsAgoDateString(from = new Date()): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() - 12)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function classifyEventsForList(
  events: EventListRow[],
  options?: { today?: string; cutoff?: string }
): { past: EventListRow[]; upcoming: EventListRow[] } {
  const today = options?.today ?? todayDateStringInKorea()
  const cutoff = options?.cutoff ?? twelveMonthsAgoDateString()
  const past: EventListRow[] = []
  const upcoming: EventListRow[] = []

  for (const event of events) {
    if (event.date < cutoff) continue

    const hasAlbum = hasEventAlbum(event)
    if (event.date >= today && !hasAlbum) {
      upcoming.push(event)
      continue
    }

    if (event.date < today || hasAlbum) {
      past.push(event)
    }
  }

  past.sort((a, b) => b.date.localeCompare(a.date))
  upcoming.sort((a, b) => a.date.localeCompare(b.date))

  return { past, upcoming }
}
