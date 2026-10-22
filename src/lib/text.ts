import { daysBetween, toISODate, type ISODate } from './dates'

/** Neutral "time since" wording. Never phrased as a warning. */
export function formatSince(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** "Alex", "Alex and Sam", "Alex, Sam and Kim", "Alex, Sam and 3 others" */
export function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`
}

/**
 * Words written in a box, as shown (never as stored): each line's ends trimmed, and blank lines at the start and
 * end left out. Blank lines between stay. Line breaks may be \r\n, \r or \n.
 */
export function displayText(text: string): string {
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim())
  const first = lines.findIndex((line) => line !== '')
  if (first === -1) return ''
  const last = lines.findLastIndex((line) => line !== '')
  return lines.slice(first, last + 1).join('\n')
}

const collator = new Intl.Collator('en', { sensitivity: 'base' })

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}

type Named = { name: string }

/** The first word of a friend's name. */
export function firstName(friend: Named): string {
  return friend.name.trim().split(/\s+/)[0]
}

/**
 * A friend's name kept short: their first name, or their full name when another friend in `among` has the same first
 * name (ignoring case). "Who paid?" passes the friends on the meetup; Birthdays soon passes every friend.
 */
export function shortName(friend: Named, among: readonly Named[]): string {
  const first = firstName(friend).toLowerCase()
  const shared = among.some((other) => other !== friend && firstName(other).toLowerCase() === first)
  return shared ? friend.name.trim() : firstName(friend)
}

/** Each friend's short name among these friends, in order: "Logged with Mariya, Jessie and Brandon". */
export function shortNames(friends: readonly Named[]): string[] {
  return friends.map((friend) => shortName(friend, friends))
}

/**
 * Every friend's short name among them all, by id: what `shortName(friend, friends)` gives, in one pass. Meetup rows
 * name people this way, so a list of many rows reads each name once.
 */
export function shortNameById(friends: readonly (Named & { id: string })[]): Map<string, string> {
  const counts = new Map<string, number>()
  for (const friend of friends) {
    const first = firstName(friend).toLowerCase()
    counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return new Map(
    friends.map((friend) => {
      const first = firstName(friend)
      return [friend.id, (counts.get(first.toLowerCase()) ?? 0) > 1 ? friend.name.trim() : first] as const
    }),
  )
}

// Intl.Segmenter arrived in iOS Safari 16.4; fall back to code points before that.
const segmenter =
  typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null

/** The first user-perceived character (keeps multi-part emoji together). */
export function firstGrapheme(value: string): string {
  const trimmed = value.trim()
  if (!segmenter) return Array.from(trimmed)[0] ?? ''
  for (const { segment } of segmenter.segment(trimmed)) return segment
  return ''
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = firstGrapheme(words[0])
  const last = words.length > 1 ? firstGrapheme(words[words.length - 1]) : ''
  return (first + last).toUpperCase()
}

export function describeLastBackup(lastBackupAt: string | null, today: ISODate): string {
  if (!lastBackupAt || Number.isNaN(new Date(lastBackupAt).getTime())) return 'Never backed up'
  const since = formatSince(daysBetween(toISODate(new Date(lastBackupAt)), today))
  return `Last backup: ${since.charAt(0).toLowerCase()}${since.slice(1)}`
}

/**
 * The Backup group's footer, facts only: the last backup, how many meetups were logged since it (when there was one
 * and some since), then how many photos a backup carries (they make it large).
 */
export function describeBackup(
  lastBackupAt: string | null,
  today: ISODate,
  photoCount: number,
  meetupsSince: number,
): string {
  const last = describeLastBackup(lastBackupAt, today)
  const backedUp = lastBackupAt !== null && !Number.isNaN(new Date(lastBackupAt).getTime())
  const parts = [
    last,
    backedUp && meetupsSince > 0 ? `${plural(meetupsSince, 'meetup')} since then` : null,
    photoCount > 0 ? `Includes ${plural(photoCount, 'photo')}` : null,
  ].filter((part): part is string => part !== null)
  return parts.length === 1 ? last : `${parts.join('. ')}.`
}
