import { INSTAGRAM_HANDLE } from '@/lib/instagram-follow-copy'

export function normalizeInstagramHandle(input: string): string | null {
  let value = input.trim()
  if (!value) return null

  value = value.replace(/^@+/, '')
  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  value = value.replace(/[/?#].*$/, '')
  value = value.trim().toLowerCase()

  if (!value || !/^[a-z0-9._]+$/.test(value)) return null
  return value
}

/** 대소문자·@·공백 무시 후 오켱 본인 계정인지 */
export function isBrandOwnInstagramHandle(input: string): boolean {
  const normalized = normalizeInstagramHandle(input)
  if (normalized) return normalized === INSTAGRAM_HANDLE
  // normalize 실패 시에도 느슨 비교 (공백/@만 다른 경우)
  const loose = input.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase()
  return loose === INSTAGRAM_HANDLE
}
