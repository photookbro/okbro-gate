/** HOME 랜딩 기본 사진 수. 대회별 보너스는 getPhotoDeliveredCount()로 합산. */
export const HOME_PHOTO_BASE_COUNT = 489_378

/**
 * 대회 ID로 5000~10000 사이 결정론적 랜덤 수를 반환.
 * 같은 ID는 항상 같은 값 → 새로고침해도 숫자 안 바뀜.
 */
function seededEventBonus(eventId: string): number {
  let h = 0
  for (let i = 0; i < eventId.length; i++) {
    h = ((h << 5) - h + eventId.charCodeAt(i)) | 0
  }
  return 5000 + Math.abs(h) % 5001
}

/** 과거 대회 목록으로 전체 사진 수 계산 (앨범 삭제 여부 무관) */
export function getPhotoDeliveredCount(pastEvents: { id: string }[]): number {
  const bonus = pastEvents.reduce((sum, e) => sum + seededEventBonus(e.id), 0)
  return HOME_PHOTO_BASE_COUNT + bonus
}

/** 오켱GATE 활동 시작일 — "N일 동안" 배지 기준 */
export const HOME_SINCE_DATE = '2025-02-18T00:00:00'

export function daysSinceHomeStart(now: Date = new Date()): number {
  const start = new Date(HOME_SINCE_DATE)
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function formatHomeCount(n: number): string {
  return n.toLocaleString('ko-KR')
}
