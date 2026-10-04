// Birthday reminders: when to remind, and what the notification says.
// Shared by the app (which builds the schedule it sends to the server) and the service worker
// (which turns a push into a notification). Nothing here reads the clock: every function takes `now`.

import type { Birthday, Friend } from '../types'
import { bytesToBase64url } from './base64'
import { isLeapYear } from './birthdays'
import { toISODate, type ISODate } from './dates'
import { compareNames, formatNameList } from './text'

/** One scheduled reminder, as the server stores it. */
export interface Reminder {
  /** UTC milliseconds: 11:55 PM on the night before the birthday, in the phone's time zone. */
  at: number
  friendId: string
}

/** A push subscription, as the app sends it to the server. */
export interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** The server keeps at most this many reminders. */
export const MAX_REMINDERS = 1000
/** The longest friend id the server takes (see server/reminders.ts). */
export const MAX_FRIEND_ID_LENGTH = 64

/** Each friend gets a reminder for this many of their next birthdays. */
export const BIRTHDAYS_AHEAD = 2

/**
 * The reminder for the birthday in `year`: 11:55 PM local time on the day before.
 * Feb 29 falls on Feb 28 in years without one. For the 1st of a month the day before is
 * day 0, which `Date` reads as the last day of the month before (Dec 31 for Jan 1).
 */
export function reminderTime(birthday: Birthday, year: number): number {
  const day = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day
  return new Date(year, birthday.month - 1, day - 1, 23, 55).getTime()
}

/**
 * The next `count` reminder times after `now`, soonest first. With a known year, the first
 * one is for their first birthday at the earliest.
 */
export function reminderTimes(birthday: Birthday, now: number, count = BIRTHDAYS_AHEAD): number[] {
  const thisYear = new Date(now).getFullYear()
  const first = birthday.year === null ? thisYear : Math.max(thisYear, birthday.year + 1)
  const times: number[] = []
  // This year's reminder may be past, and so may next year's when a Jan 1 birthday's reminder
  // (Dec 31, 11:55 PM) has just gone by, so look a couple of years further.
  for (let year = first; times.length < count && year <= first + count + 1; year += 1) {
    const at = reminderTime(birthday, year)
    if (at > now) times.push(at)
  }
  return times
}

/** Every friend's next reminders, soonest first (then by friend id), at most MAX_REMINDERS. */
export function buildReminders(friends: readonly Friend[], now: number): Reminder[] {
  const reminders: Reminder[] = []
  for (const friend of friends) {
    if (!friend.birthday) continue
    // The server refuses the whole schedule over one bad id (a hand-edited backup could have one).
    if (friend.id.length === 0 || friend.id.length > MAX_FRIEND_ID_LENGTH) continue
    for (const at of reminderTimes(friend.birthday, now)) reminders.push({ at, friendId: friend.id })
  }
  reminders.sort((a, b) => a.at - b.at || (a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0))
  return reminders.slice(0, MAX_REMINDERS)
}

/** A fingerprint of what the server would store, so the app only sends the schedule when it changed. */
export async function scheduleHash(subscription: PushSubscriptionData, reminders: readonly Reminder[]): Promise<string> {
  const text = JSON.stringify([
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    reminders.map((reminder) => [reminder.at, reminder.friendId]),
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return bytesToBase64url(new Uint8Array(digest))
}

/** What a push asks for. Reminder pushes say "birthday"; the Settings test says "test". */
export type PushKind = 'birthday' | 'test'

/** The kind in a push payload. A missing or unreadable payload counts as a birthday. */
export function pushKind(payload: unknown): PushKind {
  if (typeof payload !== 'object' || payload === null) return 'birthday'
  return (payload as { kind?: unknown }).kind === 'test' ? 'test' : 'birthday'
}

/** What the service worker shows. `url` is where tapping it goes. */
export interface Notice {
  title: string
  body: string
  tag: string
  url: string
}

/** A push arrives a few minutes before midnight, so the birthday is the date 10 minutes after it. */
const LOOK_AHEAD_MS = 10 * 60_000

export const TEST_NOTICE: Notice = {
  title: '🎂 Reminders work',
  body: "You'll get a note at 11:55 PM before each birthday.",
  tag: 'reminders-test',
  url: '/#/settings',
}

/** The birthday a push at `now` is about: the local date 10 minutes later. */
export function reminderDate(now: number): ISODate {
  return toISODate(new Date(now + LOOK_AHEAD_MS))
}

/** Shown when the friends can't be read, or nobody's birthday matches. Never show nothing. */
export function fallbackNotice(now: number): Notice {
  return {
    title: '🎂 A birthday is coming up',
    body: 'Open Friend Tracker to see who.',
    tag: `birthday-${reminderDate(now)}`,
    url: '/#/',
  }
}

/**
 * Friends whose birthday falls on `date`, by name. Feb 29 birthdays fall on Feb 28 in years
 * without one. With a known year, only from their first birthday on.
 */
export function birthdaysOn(friends: readonly Friend[], date: ISODate): Friend[] {
  const [year, month, day] = date.split('-').map(Number)
  return friends
    .filter(({ birthday }) => {
      if (!birthday || (birthday.year !== null && birthday.year >= year)) return false
      const falls = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day
      return birthday.month === month && falls === day
    })
    .sort((a, b) => compareNames(a.name, b.name))
}

/** The notification for a reminder push that arrives at `now`. */
export function birthdayNotice(friends: readonly Friend[], now: number): Notice {
  const date = reminderDate(now)
  const due = birthdaysOn(friends, date)
  if (due.length === 0) return fallbackNotice(now)
  // A late push (after midnight) speaks of today.
  const started = toISODate(new Date(now)) === date
  const tag = `birthday-${date}`
  const body = 'Send them a message.'
  if (due.length === 1) {
    const [friend] = due
    return {
      title: started ? `🎂 It's ${friend.name}'s birthday` : `🎂 ${friend.name}'s birthday starts in 5 minutes`,
      body,
      tag,
      url: `/#/friends/${encodeURIComponent(friend.id)}`,
    }
  }
  const names = formatNameList(due.map((friend) => friend.name))
  return { title: started ? `🎂 ${names}: birthdays today` : `🎂 ${names}: birthdays at midnight`, body, tag, url: '/#/' }
}
