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

const collator = new Intl.Collator('en', { sensitivity: 'base' })

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
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
