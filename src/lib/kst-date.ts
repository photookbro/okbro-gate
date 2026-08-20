const KST_OFFSET_MS = 9 * 60 * 60 * 1000

type KstParts = {
  year: number
  month: number
  day: number
  weekday: number
}

function getKstParts(date = new Date()): KstParts {
  const kst = new Date(date.getTime() + KST_OFFSET_MS)
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth(),
    day: kst.getUTCDate(),
    weekday: kst.getUTCDay(),
  }
}

function kstMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS)
}

/** Start of the given KST calendar day (00:00 KST) as UTC Date. */
export function startOfKstDay(date = new Date()): Date {
  const { year, month, day } = getKstParts(date)
  return kstMidnightUtc(year, month, day)
}

/** Start of the KST ISO week (Monday 00:00 KST). */
export function startOfKstWeek(date = new Date()): Date {
  const { year, month, day, weekday } = getKstParts(date)
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  return kstMidnightUtc(year, month, day - mondayOffset)
}

export function startOfPreviousKstWeek(date = new Date()): Date {
  const thisWeek = startOfKstWeek(date)
  return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000)
}
