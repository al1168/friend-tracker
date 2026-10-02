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
    for (const friendId of meetup.friendIds) counts.set(friendId, (counts.get(friendId) ?? 0) + 1)
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

/** Each meetup counts once, however many friends were there. */
export function totalsForYear(meetups: Meetup[], year: number, today: ISODate): YearTotals {
  const inYear = meetupsInYear(meetups, year, today)
  const friendIds = new Set(inYear.flatMap((meetup) => meetup.friendIds))
  return { meetups: inYear.length, friends: friendIds.size }
}
