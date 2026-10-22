import { formatDate, formatMonthYear, type ISODate } from '../lib/dates'
import { daySnippet } from '../lib/dayText'
import { feelingsApply } from '../lib/moods'
import { formatNameList } from '../lib/text'
import { WEATHER } from '../lib/weather'
import type { Meetup } from '../types'
import { groupByMonth, newestFirst } from './history'

// Pure: no window, document or Intl of its own, so it's tested in Node with fixed dates.

/** How many meetups Recent meetups shows on the Friends tab: the latest, on every day, so the friends show on open. */
export const RECENT_MEETUPS = 1
/** Rows the Meetups page shows at first, and how many each "Show older meetups" adds. */
export const MEETUPS_PAGE_SIZE = 60

/** The latest meetups dated today or earlier: newest date first, then the one logged later. */
export function recentMeetups(meetups: Meetup[], today: ISODate, limit = RECENT_MEETUPS): Meetup[] {
  return meetups
    .filter((meetup) => meetup.date <= today)
    .sort(newestFirst)
    .slice(0, limit)
}

/**
 * The names of who was there, in the meetup's order, from `nameById` (short names for a row's title, full names for
 * the search). Ids with no friend are skipped. `leaveOut` is the friend whose page the row is on.
 */
export function meetupNames(meetup: Meetup, nameById: ReadonlyMap<string, string>, leaveOut?: string): string[] {
  return meetup.friendIds
    .filter((friendId) => friendId !== leaveOut)
    .map((friendId) => nameById.get(friendId))
    .filter((name): name is string => name !== undefined)
}

/**
 * A meetup row's title: who was there ("Mariya, Jessie and Brandon", "Alex, Sam and 2 others"), or the type's name
 * when no one else was (on a friend's page, a meetup with just them).
 */
export function meetupTitle(names: string[], typeName: string): string {
  return names.length > 0 ? formatNameList(names) : typeName
}

/**
 * A meetup row's subtitle: the type (when the title names people; null when the title is the type), the date, the
 * activities and the day's snippet, joined by " · ".
 */
export function meetupSubtitle(meetup: Meetup, typeName: string | null, today: ISODate): string {
  return [
    typeName,
    formatDate(meetup.date, today),
    meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
    daySnippet(meetup.note),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Text folded for search: lowercased, marks removed, curly quotes made straight, runs of spaces made one. */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Everything the Meetups search looks in, folded: the names, the type's name, activities, the weather's words
 * ("Rainy"), the day, and How it felt's words when the meetup has happened (feelingsApply). Never the mood or the
 * date. The parts are joined by line breaks, which no query word holds, so a word never matches across two parts.
 */
export function meetupSearchText(meetup: Meetup, names: string[], typeName: string, today: ISODate): string {
  const weather = WEATHER.filter(({ key }) => meetup.weather.includes(key)).map(({ label }) => label)
  const parts = [...names, typeName, ...meetup.activities, ...weather, meetup.note]
  if (feelingsApply(meetup, today)) parts.push(meetup.feelings)
  return parts
    .map(searchKey)
    .filter((part) => part !== '')
    .join('\n')
}

/** True when every word of the query is found in `searchText`. A blank query matches everything. */
export function matchesSearch(searchText: string, query: string): boolean {
  return searchKey(query)
    .split(' ')
    .filter((word) => word !== '')
    .every((word) => searchText.includes(word))
}

export interface HistorySection {
  /** "upcoming", or the month as YYYY-MM */
  key: string
  /** "Upcoming", or the month as "October 2026" */
  title: string
  meetups: Meetup[]
}

/** The Meetups page's groups: Upcoming (soonest first), then each month, newest first. No empty groups. */
export function historySections(meetups: Meetup[], today: ISODate): HistorySection[] {
  const upcoming = meetups
    .filter((meetup) => meetup.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const months = groupByMonth(meetups.filter((meetup) => meetup.date <= today)).map(({ month, meetups: inMonth }) => ({
    key: month,
    title: formatMonthYear(`${month}-01`),
    meetups: inMonth,
  }))
  return upcoming.length > 0 ? [{ key: 'upcoming', title: 'Upcoming', meetups: upcoming }, ...months] : months
}

/** The first `count` rows in order across the groups (groups left empty are dropped), and how many are left. */
export function firstRows(sections: HistorySection[], count: number): { sections: HistorySection[]; more: number } {
  const shown: HistorySection[] = []
  let left = count
  let total = 0
  for (const section of sections) {
    total += section.meetups.length
    if (left <= 0) continue
    const meetups = section.meetups.length <= left ? section.meetups : section.meetups.slice(0, left)
    left -= meetups.length
    shown.push(meetups === section.meetups ? section : { ...section, meetups })
  }
  return { sections: shown, more: Math.max(0, total - count) }
}
