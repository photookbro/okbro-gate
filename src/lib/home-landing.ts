/** HOME 랜딩에 쓰는 고정 수치. 나중에 DB 집계로 교체할 때 이 값만 바꾸면 됩니다. */
export const HOME_PHOTO_DELIVERED_COUNT = 89_378

/** 오켱GATE 활동 시작일 — "N일 동안" 배지 기준 */
export const HOME_SINCE_DATE = '2025-02-18T00:00:00'

export function daysSinceHomeStart(now: Date = new Date()): number {
  const start = new Date(HOME_SINCE_DATE)
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function formatHomeCount(n: number): string {
  return n.toLocaleString('ko-KR')
}
