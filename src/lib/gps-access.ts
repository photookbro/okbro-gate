import { formatPassTimeSeconds } from '@/lib/geo'

export function formatGpsPassDisplay(passedAt: string | Date): string {
  return formatPassTimeSeconds(typeof passedAt === 'string' ? new Date(passedAt) : passedAt)
}

export type GpsPassEntry = { pass_count: number; display_time: string; passed_at: string }
export type GpsLocationPassGroup = { location_number: number; passes: GpsPassEntry[] }

/** gps_logs 원시 row들을 위치별로 묶어서 회차순 정렬 — 마이페이지/이벤트 목록에서 공용으로 사용 */
export function groupGpsLogsByLocation(
  logs: { location_number: number | null; pass_count: number | null; passed_at: string | null }[]
): GpsLocationPassGroup[] {
  const map = new Map<number, GpsPassEntry[]>()

  for (const log of logs) {
    if (!log.passed_at) continue
    const locationNumber = log.location_number ?? 1
    const list = map.get(locationNumber) ?? []
    list.push({
      pass_count: log.pass_count ?? list.length + 1,
      display_time: formatGpsPassDisplay(log.passed_at),
      passed_at: log.passed_at,
    })
    map.set(locationNumber, list)
  }

  return [...map.entries()]
    .map(([location_number, passes]) => ({
      location_number,
      passes: [...passes].sort((a, b) => a.pass_count - b.pass_count),
    }))
    .sort((a, b) => a.location_number - b.location_number)
}
