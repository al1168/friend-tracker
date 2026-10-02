import type { Meetup } from '../types'

export interface MonthGroup {
  /** YYYY-MM */
  month: string
  meetups: Meetup[]
}

/** Newest month first; within a month, newest date first, then most recently logged. */
export function groupByMonth(meetups: Meetup[]): MonthGroup[] {
  const sorted = [...meetups].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const groups: MonthGroup[] = []
  for (const meetup of sorted) {
    const month = meetup.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.meetups.push(meetup)
    else groups.push({ month, meetups: [meetup] })
  }
  return groups
}
