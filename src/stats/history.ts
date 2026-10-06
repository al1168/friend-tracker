import type { Meetup } from '../types'

export interface MonthGroup {
  /** YYYY-MM */
  month: string
  meetups: Meetup[]
}

/** Newest date first, then most recently logged: the order of every list of meetups that happened. */
export function newestFirst(a: Meetup, b: Meetup): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
}

/** Newest month first; within a month, newest date first, then most recently logged. */
export function groupByMonth(meetups: Meetup[]): MonthGroup[] {
  const sorted = [...meetups].sort(newestFirst)
  const groups: MonthGroup[] = []
  for (const meetup of sorted) {
    const month = meetup.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.meetups.push(meetup)
    else groups.push({ month, meetups: [meetup] })
  }
  return groups
}
