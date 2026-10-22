import { daysBetween, toISODate } from '../lib/dates'
import type { Meetup } from '../types'

// When the app suggests a backup: a quiet dot on the Settings tab, never red, never a count of days. Pure, so it's
// tested in Node with fixed dates. Days are the phone's calendar days, like the Backup footer's "4 weeks ago".

/** Days between a backup and the first suggestion to make another, and between suggestions. */
export const BACKUP_NUDGE_DAYS = 30

type Logged = Pick<Meetup, 'createdAt'>

/** The time an ISO string names, or null when it names none. */
function timeOf(iso: string | null): number | null {
  if (iso === null) return null
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}

/** Calendar days from `iso` to `now`, or null when `iso` isn't a time. */
export function daysSince(iso: string | null, now: Date): number | null {
  const time = timeOf(iso)
  return time === null ? null : daysBetween(toISODate(new Date(time)), toISODate(now))
}

/** Meetups logged after the last backup (all of them when there has been none). */
export function meetupsSinceBackup(meetups: readonly Logged[], lastBackupAt: string | null): number {
  const last = timeOf(lastBackupAt)
  if (last === null) return meetups.length
  return meetups.filter((meetup) => (timeOf(meetup.createdAt) ?? -Infinity) > last).length
}

/** A backup is due: something logged since, and 30 or more days since the last backup (or since the first meetup, with none). */
export function backupDue(meetups: readonly Logged[], lastBackupAt: string | null, now: Date): boolean {
  if (meetupsSinceBackup(meetups, lastBackupAt) === 0) return false
  const sinceBackup = daysSince(lastBackupAt, now)
  if (sinceBackup !== null) return sinceBackup >= BACKUP_NUDGE_DAYS
  let first = Infinity
  for (const meetup of meetups) first = Math.min(first, timeOf(meetup.createdAt) ?? Infinity)
  return Number.isFinite(first) && daysBetween(toISODate(new Date(first)), toISODate(now)) >= BACKUP_NUDGE_DAYS
}

/** The Settings tab's dot: due, and not seen in the last 30 days. */
export function showBackupDot(due: boolean, seenAt: string | null, now: Date): boolean {
  if (!due) return false
  const seen = daysSince(seenAt, now)
  return seen === null || seen >= BACKUP_NUDGE_DAYS
}
