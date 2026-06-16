export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export function formatDateDigits(digits: string): string {
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

/** 20250608, 2025-06-08 등 → YYYY-MM-DD 형태로 실시간 포맷 */
export function formatDateInputValue(raw: string): string {
  return formatDateDigits(digitsOnly(raw))
}

export function isCompleteIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}
