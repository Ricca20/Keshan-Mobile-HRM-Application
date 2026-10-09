import { fromZonedTime } from 'date-fns-tz'

/**
 * All business dates are in Sri Lanka time. Servers (Vercel) run in UTC, so never
 * rely on the process timezone (`setHours`, `getDate`, date-fns `parse`, ...).
 */
export const TZ = 'Asia/Colombo'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isDateStr(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !isNaN(d.getTime()) && d.toISOString().startsWith(value)
}

export function isTimeStr(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

/** 'YYYY-MM-DD' of the given instant in Colombo. */
export function colomboDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** UTC instants for the start and end of a Colombo calendar day. */
export function colomboDayRange(dateStr: string): { start: Date; end: Date } {
  return {
    start: fromZonedTime(`${dateStr}T00:00:00`, TZ),
    end: fromZonedTime(`${dateStr}T23:59:59.999`, TZ),
  }
}

/** UTC instant for an 'HH:mm' wall-clock time on a Colombo calendar day. */
export function colomboTime(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TZ)
}

/** Value to store/compare against `@db.Date` columns (UTC midnight of that calendar day). */
export function dbDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/** Calendar date string of a `@db.Date` value. */
export function dbDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(dateStr: string, days: number): string {
  const d = dbDate(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return dbDateStr(d)
}

/** 0 = Sunday … 6 = Saturday, for a calendar date string. */
export function dayOfWeek(dateStr: string): number {
  return dbDate(dateStr).getUTCDay()
}

/** Inclusive list of calendar date strings between two date strings. */
export function eachDateStr(startStr: string, endStr: string): string[] {
  const days: string[] = []
  for (let d = startStr; d <= endStr; d = addDays(d, 1)) days.push(d)
  return days
}

/** First and last calendar date strings of a month. */
export function monthBounds(month: number, year: number): { first: string; last: string } {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { first, last: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` }
}
