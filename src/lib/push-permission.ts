export type MobilePlatform = 'ios' | 'android' | 'other'

export function detectMobilePlatform(userAgent: string): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}
