/** A calendar date in the phone's local time zone, formatted YYYY-MM-DD. */
export type ISODate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function parts(iso: ISODate): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number)
  return [year, month, day]
}

function toUTCms(iso: ISODate): number {
  const [year, month, day] = parts(iso)
  return Date.UTC(year, month - 1, day)
}

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = parts(value)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTCms(to) - toUTCms(from)) / DAY_MS)
}

export function addDays(iso: ISODate, days: number): ISODate {
  return new Date(toUTCms(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function yearOf(iso: ISODate): number {
  return Number(iso.slice(0, 4))
}

/** 0 = January */
export function monthIndexOf(iso: ISODate): number {
  return Number(iso.slice(5, 7)) - 1
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const dayFormatWithYear = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthYearFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Sat, Sep 12" in the current year, "Fri, Sep 12, 2025" otherwise. */
export function formatDate(iso: ISODate, today: ISODate): string {
  const date = new Date(toUTCms(iso))
  return yearOf(iso) === yearOf(today) ? dayFormat.format(date) : dayFormatWithYear.format(date)
}

/** "Oct 22": no weekday and no year, for a date the words around it place ("By Oct 22 last year"). */
export function formatMonthDay(iso: ISODate): string {
  return monthDayFormat.format(new Date(toUTCms(iso)))
}

/** "September 2026" */
export function formatMonthYear(iso: ISODate): string {
  return monthYearFormat.format(new Date(toUTCms(iso)))
}

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
