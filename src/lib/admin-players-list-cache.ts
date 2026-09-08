import type { AdminPlayerListRow } from '@/lib/admin-players-list-server'

const TTL_MS = 45_000

type CacheEntry = {
  players: AdminPlayerListRow[]
  builtAt: number
}

let cache: CacheEntry | null = null

export function getAdminPlayersListCache(): AdminPlayerListRow[] | null {
  if (!cache) return null
  if (Date.now() - cache.builtAt > TTL_MS) {
    cache = null
    return null
  }
  return cache.players
}

export function setAdminPlayersListCache(players: AdminPlayerListRow[]): void {
  cache = { players, builtAt: Date.now() }
}

export function invalidateAdminPlayersListCache(): void {
  cache = null
}
