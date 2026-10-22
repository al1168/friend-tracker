import { formatDate, toISODate, type ISODate } from '../lib/dates'
import { plural } from '../lib/text'
import type { BackupData } from './format'

// The words of the import confirm, which compares a backup with what's in the app before replacing it. Pure: the
// counts, ids and dates come in as arguments.

/** How much a set of data holds. */
export interface DataCounts {
  friends: number
  meetups: number
  photos: number
}

/** What's in the app now: its counts, and the ids of its friends and meetups. */
export interface AppNow extends DataCounts {
  friendIds: readonly string[]
  meetupIds: readonly string[]
}

/** The last line of a confirm that replaces the app's data. */
const REPLACED = 'Everything in the app now will be replaced.'

/** "15 friends, 30 meetups, 6 photos", the photos only `withPhotos` (when either side has any). */
function countList(counts: DataCounts, withPhotos: boolean): string {
  const parts = [plural(counts.friends, 'friend'), plural(counts.meetups, 'meetup')]
  if (withPhotos) parts.push(plural(counts.photos, 'photo'))
  return parts.join(', ')
}

/** "In the app now: 15 friends, 39 meetups, 9 photos.", or that there's nothing yet. */
export function appNowLine(app: DataCounts, withPhotos: boolean): string {
  if (app.friends === 0 && app.meetups === 0) return 'No friends or meetups in the app yet.'
  return `In the app now: ${countList(app, withPhotos)}.`
}

/** "9 meetups in the app now aren't in this backup.", or null when nothing in the app would be lost. */
function lostLine(backup: BackupData, app: AppNow): string | null {
  const friendIds = new Set(backup.friends.map((friend) => friend.id))
  const meetupIds = new Set(backup.meetups.map((meetup) => meetup.id))
  const friends = app.friendIds.filter((id) => !friendIds.has(id)).length
  const meetups = app.meetupIds.filter((id) => !meetupIds.has(id)).length
  const parts = [friends > 0 ? plural(friends, 'friend') : null, meetups > 0 ? plural(meetups, 'meetup') : null]
  const named = parts.filter((part): part is string => part !== null)
  if (named.length === 0) return null
  const one = friends + meetups === 1
  return `${named.join(' and ')} in the app now ${one ? "isn't" : "aren't"} in this backup.`
}

/**
 * The import confirm's message, a line each: the backup (when it was made, and what it holds), what's in the app
 * now, what in the app isn't in the backup, and that the app's data will be replaced. The last two show only when
 * there's something in the app to lose or replace.
 */
export function describeImport(backup: BackupData, exportedAt: string | null, app: AppNow, today: ISODate): string {
  const counts = { friends: backup.friends.length, meetups: backup.meetups.length, photos: backup.meetupPhotos.length }
  const withPhotos = counts.photos > 0 || app.photos > 0
  const from = exportedAt === null ? 'This backup' : `Backup from ${formatDate(toISODate(new Date(exportedAt)), today)}`
  const lines = [`${from}: ${countList(counts, withPhotos)}.`, appNowLine(app, withPhotos)]
  if (app.friends > 0 || app.meetups > 0) {
    const lost = lostLine(backup, app)
    if (lost) lines.push(lost)
    lines.push(REPLACED)
  }
  return lines.join('\n')
}
