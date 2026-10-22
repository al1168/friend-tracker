import { monthIndexOf, yearOf, type ISODate } from '../lib/dates'
import type { Meetup } from '../types'

/** Meetups dated on or before today. Future meetups never count. */
export function pastMeetups(meetups: Meetup[], today: ISODate): Meetup[] {
  return meetups.filter((meetup) => meetup.date <= today)
}

export function meetupsInYear(meetups: Meetup[], year: number, today: ISODate): Meetup[] {
  return pastMeetups(meetups, today).filter((meetup) => yearOf(meetup.date) === year)
}

function countByFriend(meetups: Meetup[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const meetup of meetups) {
    for (const friendId of new Set(meetup.friendIds)) counts.set(friendId, (counts.get(friendId) ?? 0) + 1)
  }
  return counts
}

/** friendId → number of meetups with them in `year`. */
export function countsByFriendForYear(meetups: Meetup[], year: number, today: ISODate): Map<string, number> {
  return countByFriend(meetupsInYear(meetups, year, today))
}

/** friendId → number of meetups with them, ever. */
export function allTimeCountsByFriend(meetups: Meetup[], today: ISODate): Map<string, number> {
  return countByFriend(pastMeetups(meetups, today))
}

/** Meetups with one friend per month of `year` (index 0 = January). */
export function monthlyCounts(friendId: string, meetups: Meetup[], year: number, today: ISODate): number[] {
  const counts = Array.from({ length: 12 }, () => 0)
  for (const meetup of meetupsInYear(meetups, year, today)) {
    if (meetup.friendIds.includes(friendId)) counts[monthIndexOf(meetup.date)] += 1
  }
  return counts
}

export interface YearTotals {
  meetups: number
  friends: number
}

function totalsOf(meetups: Meetup[]): YearTotals {
  const friendIds = new Set(meetups.flatMap((meetup) => meetup.friendIds))
  return { meetups: meetups.length, friends: friendIds.size }
}

/** Each meetup counts once, however many friends were there. */
export function totalsForYear(meetups: Meetup[], year: number, today: ISODate): YearTotals {
  return totalsOf(meetupsInYear(meetups, year, today))
}

/**
 * The year of the first meetup, or this year when there's none earlier. No year before it is offered on Stats or
 * compared with: the app wasn't in use, so its zeros would say nothing.
 */
export function firstYear(meetups: Meetup[], today: ISODate): number {
  let first = yearOf(today)
  for (const meetup of meetups) first = Math.min(first, yearOf(meetup.date))
  return first
}

/** The same month and day a year earlier, for "by this date last year". Feb 29 becomes Feb 28. */
export function sameDateLastYear(today: ISODate): ISODate {
  const monthDay = today.slice(5) === '02-29' ? '02-28' : today.slice(5)
  return `${yearOf(today) - 1}-${monthDay}`
}

/** Last year's meetups from Jan 1 up to and including today's date a year ago. */
function lastYearByDate(meetups: Meetup[], today: ISODate): Meetup[] {
  const through = sameDateLastYear(today)
  const year = yearOf(through)
  return meetups.filter((meetup) => yearOf(meetup.date) === year && meetup.date <= through)
}

/** Last year up to today's date a year ago ("By Oct 22 last year: 11 meetups."), and that date. */
export function totalsByDateLastYear(meetups: Meetup[], today: ISODate): YearTotals & { through: ISODate } {
  return { ...totalsOf(lastYearByDate(meetups, today)), through: sameDateLastYear(today) }
}

/** friendId → meetups with them last year, up to today's date a year ago ("3 by Oct 22"). */
export function countsByFriendByDateLastYear(meetups: Meetup[], today: ISODate): Map<string, number> {
  return countByFriend(lastYearByDate(meetups, today))
}
