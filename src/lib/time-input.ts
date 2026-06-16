export function digitsOnlyTime(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function formatTimeDigits(digits: string): string {
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`
}

/** 143245, 14:32:45 → HH:MM:SS */
export function formatTimeInputValue(raw: string): string {
  return formatTimeDigits(digitsOnlyTime(raw))
}

export function isCompleteTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3])
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

export function buildPassedAtFromEventDate(eventDate: string, passedTime: string): string {
  return `${eventDate}T${passedTime}+09:00`
}
