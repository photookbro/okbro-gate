const INSTAGRAM_PROFILE_RE = /instagram\.com\/([a-zA-Z0-9_.]+)/g

/** 인스타 시스템 경로 — 프로필이 아닌 링크 제외 */
const RESERVED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'stories',
  'explore',
  'accounts',
  'direct',
  'about',
  'legal',
  'privacy',
  'terms',
  'developer',
  'api',
  'static',
  'email',
  'web',
  'help',
  'directory',
  'nametag',
])

export function parseInstagramFollowersFromHtml(html: string): string[] {
  const seen = new Set<string>()
  const usernames: string[] = []

  for (const match of html.matchAll(INSTAGRAM_PROFILE_RE)) {
    const username = match[1]
    if (!username) continue
    if (RESERVED_PATHS.has(username.toLowerCase())) continue
    const key = username.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    usernames.push(username)
  }

  return usernames
}

/** 여러 HTML에서 뽑은 아이디를 대소문자 무시하고 합침(먼저 나온 표기 유지) */
export function mergeInstagramFollowerUsernames(lists: string[][]): string[] {
  const seen = new Set<string>()
  const usernames: string[] = []

  for (const list of lists) {
    for (const username of list) {
      const trimmed = username.trim()
      if (!trimmed) continue
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      usernames.push(trimmed)
    }
  }

  return usernames
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
