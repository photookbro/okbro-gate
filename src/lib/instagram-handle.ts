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
