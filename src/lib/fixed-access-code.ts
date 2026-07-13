export const FIXED_ACCESS_CODE = '19750905'

export function isFixedAccessCode(orderNumber: string | null | undefined): boolean {
  return !!orderNumber && orderNumber.trim() === FIXED_ACCESS_CODE
}
