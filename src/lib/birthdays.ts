// Rules and wording for friends' birthdays, shared by the data layer, the backup parser and the screens.
// Every function that needs the date takes `today` (the phone's local date) and never reads the clock.

import type { Birthday, Friend } from '../types'
import { daysBetween, MONTH_NAMES, yearOf, type ISODate } from './dates'
import { compareNames } from './text'

/** The earliest birth year the app accepts. */
export const MIN_BIRTH_YEAR = 1900

// What the Edit friend sheet says when it can't save a birthday.
const PICK_MONTH_AND_DAY = 'Pick a month and a day.'
const NOT_A_DATE = "That date doesn't exist."
const IN_THE_FUTURE = 'That date is in the future.'

/** Days in each month of a leap year: a birthday without a year can be Feb 29. */
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** The last day a birthday in `month` (1 to 12) can fall on: 29 for February, and 31 when no month is picked. */
export function maxDay(month: number | null): number {
  return month === null ? 31 : MONTH_LENGTHS[month - 1]
}

function isoDate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Why a birthday isn't valid, in the sheet's words, or null when it is. The month and day must make a
 * real date (Feb 29 included). A year must be 1900 or later, the date must exist in it (Feb 29 needs a
 * leap year), and it can't be after today. (Out-of-range values only come from code or edited backups,
 * and count as a date that doesn't exist.)
 */
export function birthdayProblem(birthday: Birthday, today: ISODate): string | null {
  const { month, day, year } = birthday
  if (!Number.isInteger(month) || month < 1 || month > 12) return NOT_A_DATE
  if (!Number.isInteger(day) || day < 1 || day > maxDay(month)) return NOT_A_DATE
  if (year === null) return null
  if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR) return NOT_A_DATE
  if (month === 2 && day === 29 && !isLeapYear(year)) return NOT_A_DATE
  if (year > yearOf(today) || isoDate(year, month, day) > today) return IN_THE_FUTURE
  return null
}

/** Whether `value` is a valid birthday: `{ month, day, year }` with numbers (year may be null) that pass the rules. */
export function isValidBirthday(value: unknown, today: ISODate): value is Birthday {
  if (typeof value !== 'object' || value === null) return false
  const { month, day, year } = value as Record<string, unknown>
  if (typeof month !== 'number' || typeof day !== 'number') return false
  if (year !== null && typeof year !== 'number') return false
  return birthdayProblem({ month, day, year }, today) === null
}

/** The Edit friend sheet's three selects. Null where nothing is picked ("Month", "Day", "No year"). */
export interface BirthdayFields {
  month: number | null
  day: number | null
  year: number | null
}

/** All three selects empty. */
export const EMPTY_BIRTHDAY_FIELDS: BirthdayFields = { month: null, day: null, year: null }

export type BirthdayFieldsResult = { ok: true; birthday: Birthday | null } | { ok: false; error: string }

/** Reads the sheet's selects on Save. With month and day both empty there's no birthday (a year alone is dropped). */
export function birthdayFromFields(fields: BirthdayFields, today: ISODate): BirthdayFieldsResult {
  const { month, day, year } = fields
  if (month === null && day === null) return { ok: true, birthday: null }
  if (month === null || day === null) return { ok: false, error: PICK_MONTH_AND_DAY }
  const birthday: Birthday = { month, day, year }
  const problem = birthdayProblem(birthday, today)
  return problem === null ? { ok: true, birthday } : { ok: false, error: problem }
}

/** The date the birthday falls on in `year`. Feb 29 falls on Feb 28 in years without one. */
function birthdayIn(birthday: Birthday, year: number): ISODate {
  const leapDayMoves = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year)
  return isoDate(year, birthday.month, leapDayMoves ? 28 : birthday.day)
}

/** The next date the birthday falls on, today included. With a known year, never before the first birthday. */
export function nextBirthday(birthday: Birthday, today: ISODate): ISODate {
  const first = birthday.year === null ? yearOf(today) : Math.max(yearOf(today), birthday.year + 1)
  const thisYear = birthdayIn(birthday, first)
  return thisYear >= today ? thisYear : birthdayIn(birthday, first + 1)
}

/** Days until the next birthday. 0 means today. */
export function daysUntilBirthday(birthday: Birthday, today: ISODate): number {
  return daysBetween(today, nextBirthday(birthday, today))
}

/** The age they turn on their next birthday, or null when the year isn't known. */
export function ageOnNextBirthday(birthday: Birthday, today: ISODate): number | null {
  return birthday.year === null ? null : yearOf(nextBirthday(birthday, today)) - birthday.year
}

/** "March 14, 1996", or "March 14" without a year. */
export function formatBirthday(birthday: Birthday): string {
  const date = `${MONTH_NAMES[birthday.month - 1]} ${birthday.day}`
  return birthday.year === null ? date : `${date}, ${birthday.year}`
}

/** "Today", "Tomorrow" or "In 12 days", plus the age when the year is known: "In 12 days · turns 31". */
export function describeNextBirthday(birthday: Birthday, today: ISODate): string {
  const days = daysUntilBirthday(birthday, today)
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  const age = ageOnNextBirthday(birthday, today)
  return age === null ? when : `${when} · turns ${age}`
}

export interface UpcomingBirthday {
  friend: Friend
  birthday: Birthday
  /** Days until it. 0 means today. */
  daysUntil: number
}

/** Friends whose next birthday is within `days` days (today included), soonest first, then by name. */
export function upcomingBirthdays(friends: readonly Friend[], today: ISODate, days = 14): UpcomingBirthday[] {
  const upcoming: UpcomingBirthday[] = []
  for (const friend of friends) {
    const { birthday } = friend
    if (!birthday) continue
    const daysUntil = daysUntilBirthday(birthday, today)
    if (daysUntil <= days) upcoming.push({ friend, birthday, daysUntil })
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil || compareNames(a.friend.name, b.friend.name))
}
