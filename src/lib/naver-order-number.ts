import { kstMidnight, startOfKstDay } from './date-input'

export const NAVER_ORDER_NUMBER_LENGTH = 16
export const NAVER_ORDER_RECENT_DAYS = 3
export const NAVER_ORDER_PLACEHOLDER = 'xxxxxxxxxxxxxxxx'
export const INVALID_NAVER_ORDER_MESSAGE = '유효하지 않은 주문번호입니다'
export const NAVER_ORDER_TOO_OLD_MESSAGE = '최근 3일 이내 주문만 인증할 수 있어요'

export type NaverOrderValidationResult =
  | { ok: true; orderDate: Date }
  | { ok: false; error: string }

export function isNaverOrderNumberFormat(value: string): boolean {
  return /^\d{16}$/.test(value.trim())
}

export function parseNaverOrderDate(orderNumber: string): Date | null {
  const trimmed = orderNumber.trim()
  if (!isNaverOrderNumberFormat(trimmed)) return null

  const year = Number(trimmed.slice(0, 4))
  const month = Number(trimmed.slice(4, 6))
  const day = Number(trimmed.slice(6, 8))

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // 유효한 달력 날짜인지 검증 (예: 2월 30일 같은 존재하지 않는 날짜 걸러내기)
  const validityCheck = new Date(year, month - 1, day)
  if (
    validityCheck.getFullYear() !== year ||
    validityCheck.getMonth() !== month - 1 ||
    validityCheck.getDate() !== day
  ) {
    return null
  }

  // 주문번호에 박힌 날짜는 한국 달력 기준이므로 KST 자정으로 고정
  return kstMidnight(year, month, day)
}

export function isNaverOrderDateWithinRecentDays(
  orderDate: Date,
  recentDays: number = NAVER_ORDER_RECENT_DAYS,
  now: Date = new Date()
): boolean {
  const today = startOfKstDay(now)
  const orderDay = orderDate

  if (orderDay > today) return false

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - recentDays)
  return orderDay >= cutoff
}

export function validateNaverOrderNumber(
  orderNumber: string,
  now: Date = new Date()
): NaverOrderValidationResult {
  const trimmed = orderNumber.trim()

  if (!isNaverOrderNumberFormat(trimmed)) {
    return { ok: false, error: INVALID_NAVER_ORDER_MESSAGE }
  }

  const orderDate = parseNaverOrderDate(trimmed)
  if (!orderDate) {
    return { ok: false, error: INVALID_NAVER_ORDER_MESSAGE }
  }

  if (!isNaverOrderDateWithinRecentDays(orderDate, NAVER_ORDER_RECENT_DAYS, now)) {
    return { ok: false, error: NAVER_ORDER_TOO_OLD_MESSAGE }
  }

  return { ok: true, orderDate }
}
